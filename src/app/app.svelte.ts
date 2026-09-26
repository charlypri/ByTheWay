// Une las piezas del dominio (catálogo, motor, Narrador, seguimiento, posición) con el mapa y
// expone a la interfaz un estado reactivo. Las dependencias con el navegador se inyectan en main.ts.
import { Catalog, CatalogUnavailable } from '../lib/catalog';
import { shouldBeDark } from '../lib/daylight';
import { FollowCamera } from '../lib/follow';
import { Guide, RULES, type Fix, type PoiState } from '../lib/guide';
import { formatDistance, t, type StringKey } from '../lib/i18n';
import { distanceM, textFor, type Lang, type Poi } from '../lib/kml';
import type { NarrationProgress, Narrator } from '../lib/narrator';
import type { PositionError, PositionSource } from '../lib/position';
import type { KeyValueStore } from '../lib/storage';
import type { GuideMap } from '../map/guide-map';

export interface AppDeps {
    store: KeyValueStore;
    catalog: Catalog;
    narrator: Narrator;
    position: PositionSource;
    now(): number;
    /** ¿Pide el sistema el tema oscuro? `onChange` avisa cuando cambia. */
    systemDark: { matches(): boolean; onChange(fn: () => void): void };
    createMap(container: HTMLElement, opts: { dark: boolean; lang: Lang }): Promise<GuideMap>;
}

export interface Narration {
    poi: Poi;
    progress: NarrationProgress;
    paused: boolean;
}

export interface FollowView {
    active: boolean;
    headingUp: boolean;
    northLocked: boolean;
    pitched: boolean;
}

/** El tema se revisa como mucho una vez por minuto (sección 5). */
const DARK_CHECK_MS = 60_000;

export class App {
    lang = $state<Lang>('es');
    dark = $state(false);
    pois = $state.raw<Poi[]>([]);
    /** Sube cada vez que cambia el estado de algún POI. */
    revision = $state(0);
    fix = $state.raw<Fix | null>(null);
    selected = $state.raw<Poi | null>(null);
    sheet = $state.raw<Poi | null>(null);
    narration = $state.raw<Narration | null>(null);
    follow = $state<FollowView>({ active: true, headingUp: false, northLocked: false, pitched: true });
    /** Rumbo del mapa, para la aguja de la brújula. */
    bearing = $state(0);
    mapReady = $state(false);
    dataReady = $state(false);
    dataError = $state(false);
    positionError = $state<PositionError | null>(null);
    started = $state(false);

    guide!: Guide;
    map!: GuideMap;
    camera!: FollowCamera;
    /** Píxeles que tapa la interfaz inferior; la mide la interfaz. */
    bottomInset = 0;

    private lastDarkCheck = -Infinity;
    /** Al abrir la ficha: ¿seguía la cámara al usuario? ¿movió el mapa mientras tanto? */
    private sheetFollow = { was: false, panned: false };
    private mapMoveListeners = new Set<() => void>();

    constructor(readonly deps: AppDeps) {
        this.lang = deps.store.get<Lang>('lang') ?? 'es';
        this.dark = shouldBeDark(deps.systemDark.matches(), null, new Date(deps.now()));
    }

    get narrator() {
        return this.deps.narrator;
    }

    /** Descarga los datos y crea el mapa a la vez. */
    async boot(container: HTMLElement) {
        const { catalog, narrator, store, now } = this.deps;
        const data = this.loadData();
        this.map = await this.deps.createMap(container, { dark: this.dark, lang: this.lang });
        this.camera = new FollowCamera(this.map.camera, () => this.bottomInset);
        this.camera.on('change', () => this.syncFollow());
        this.syncFollow();
        this.map.camera.onGesture(() => {
            if (this.sheet) this.sheetFollow.panned = true;
        });
        this.map.onPoiClick((poi) => this.select(poi));
        this.map.onBackgroundClick(() => this.select(null));
        const ml = this.map.ml;
        ml.on('move', () => this.mapMoveListeners.forEach((fn) => fn()));
        ml.on('rotate', () => (this.bearing = ml.getBearing()));
        ml.once('load', () => this.redraw());
        this.mapReady = true;

        this.guide = new Guide(catalog.pois, {
            store,
            now,
            announce: (poi) => {
                const tx = textFor(poi, this.lang);
                return narrator.say(tx.title, tx.lang);
            },
        });
        this.guide.on('states', () => {
            this.revision++;
            this.redraw();
        });
        catalog.onChange((pois) => {
            this.pois = pois;
            this.guide.setPois(pois);
            this.refreshSelection();
        });
        this.pois = catalog.pois;

        narrator.on('progress', (progress) => {
            if (this.narration) this.narration = { ...this.narration, progress, paused: narrator.paused };
        });
        narrator.on('end', () => {
            this.narration = null;
            this.guide.endNarration();
            catalog.setBusy(false);
        });

        this.deps.systemDark.onChange(() => this.evaluateDark(true));
        await data;
        this.redraw();
    }

    /** Vuelve a intentar la primera descarga de los lugares. */
    retryData() {
        void this.loadData();
    }

    private async loadData() {
        this.dataError = false;
        try {
            await this.deps.catalog.start();
            this.dataReady = true;
        } catch (e) {
            if (e instanceof CatalogUnavailable) this.dataError = true;
            else throw e;
        }
    }

    /** Empieza a seguir la posición. */
    start() {
        if (this.started) return;
        this.started = true;
        this.deps.position.start(
            (fix) => this.onFix(fix),
            (error) => (this.positionError = error),
        );
    }

    // ------------------------------------------------------------------ estado de los POIs

    stateOf(poi: Poi): PoiState {
        void this.revision;
        return this.guide?.stateOf(poi) ?? 'pending';
    }

    isInside(poi: Poi) {
        void this.revision;
        void this.fix;
        return this.guide?.isInside(poi) ?? false;
    }

    text(poi: Poi) {
        return textFor(poi, this.lang);
    }

    /** Un texto de la interfaz en el idioma de la app. */
    t(key: StringKey, vars?: Record<string, string | number>) {
        return t(this.lang, key, vars);
    }

    distanceTo(poi: Poi): number | null {
        return this.fix ? distanceM(poi, this.fix) : null;
    }

    /** "a 120 m de ti" o, dentro del radio, "Estás aquí · 10 m". */
    distanceText(poi: Poi): string {
        const d = this.distanceTo(poi);
        if (d == null) return '';
        const txt = formatDistance(d, this.lang);
        return this.isInside(poi) ? `${this.t('nearYou')} · ${txt}` : this.t('distance', { d: txt });
    }

    stateText(state: PoiState): string {
        return state === 'playing' ? this.t('playingNow') : state === 'heard' ? this.t('heard') : state === 'announced' ? this.t('announced') : '';
    }

    /** ¿Tiene el GPS precisión suficiente para las Entradas? */
    get weakFix() {
        return !!this.fix && this.fix.accuracy > RULES.maxAccuracyM;
    }

    // ------------------------------------------------------------------ selección y ficha

    select(poi: Poi | null) {
        if (this.sheet && poi?.id !== this.sheet.id) this.closeSheet(false);
        this.selected = poi;
        this.redraw();
    }

    openSheet(poi: Poi) {
        if (!this.sheet) this.sheetFollow = { was: this.camera.active, panned: false };
        this.sheet = poi;
        if (this.selected?.id !== poi.id) {
            this.selected = poi;
            this.redraw();
        }
        this.camera.suspend();
    }

    /** Centra el POI en el hueco que deja la ficha abierta. */
    frameSheet(sheetHeight: number) {
        if (this.sheet) this.map.flyTo(this.sheet, sheetHeight + 28);
    }

    /** `deselect`: false cuando la ficha se cierra porque ya cambió la selección. */
    closeSheet(deselect = true) {
        if (!this.sheet) return;
        this.sheet = null;
        if (deselect) {
            this.selected = null;
            this.redraw();
        }
        // Vuelve a seguirte solo si te seguía al abrirla y no has movido el mapa.
        if (this.sheetFollow.was && !this.sheetFollow.panned) this.camera.recenter();
    }

    onMapMove(fn: () => void) {
        this.mapMoveListeners.add(fn);
        return () => this.mapMoveListeners.delete(fn);
    }

    // ------------------------------------------------------------------ Narración

    narrate(poi: Poi) {
        const tx = textFor(poi, this.lang);
        this.guide.startNarration(poi);
        this.deps.catalog.setBusy(true);
        this.narration = { poi, progress: { index: 0, total: 1 }, paused: false };
        this.narrator.narrate(tx.title, tx.description, tx.lang);
    }

    /** Escuchar: empieza la Narración o, si ya suena la de ese POI, la pausa o la sigue. */
    listen(poi: Poi) {
        if (this.narration?.poi.id === poi.id) this.togglePause();
        else this.narrate(poi);
    }

    togglePause() {
        if (!this.narration) return;
        if (this.narrator.paused) this.narrator.resume();
        else this.narrator.pause();
        this.narration = { ...this.narration, paused: this.narrator.paused };
    }

    stopNarration() {
        this.narrator.stop();
    }

    // ------------------------------------------------------------------ ajustes

    setLang(lang: Lang) {
        if (lang === this.lang) return;
        this.lang = lang;
        this.deps.store.set('lang', lang);
        this.map?.setLanguage(lang);
        this.redraw();
    }

    // ------------------------------------------------------------------ interno

    private onFix(fix: Fix) {
        this.fix = fix;
        this.positionError = null;
        this.map.setUser(fix, this.weakFix);
        this.camera.update(fix);
        this.guide.update(fix);
        this.evaluateDark();
    }

    /** Oscuro si el sistema lo pide o si es de noche donde está el usuario. */
    private evaluateDark(force = false) {
        const now = this.deps.now();
        if (!force && now - this.lastDarkCheck < DARK_CHECK_MS) return;
        this.lastDarkCheck = now;
        const dark = shouldBeDark(this.deps.systemDark.matches(), this.fix, new Date(now));
        if (dark === this.dark) return;
        this.dark = dark;
        this.map?.setDark(dark);
    }

    private syncFollow() {
        const c = this.camera;
        this.follow = { active: c.active, headingUp: c.headingUp, northLocked: c.northLocked, pitched: c.pitched };
    }

    /** Si una versión nueva del catálogo cambia un POI abierto, se muestra la nueva. */
    private refreshSelection() {
        const byId = new Map(this.pois.map((p) => [p.id, p]));
        if (this.selected) this.selected = byId.get(this.selected.id) ?? null;
        if (this.sheet) this.sheet = byId.get(this.sheet.id) ?? null;
        this.redraw();
    }

    private redraw() {
        if (!this.map || !this.guide) return;
        this.map.renderPois(this.pois, (p) => this.guide.stateOf(p), this.lang, this.selected?.id ?? null);
    }
}
