// Conecta datos, motor, voz, mapa, seguimiento y simulador. Cada mock solo aporta su interfaz.
import { textFor, type Lang, type Poi } from '../../src/lib/kml';
import { loadPois } from './data';
import { Follow } from './follow';
import { Guide, type Fix } from './guide';
import { createGuideMap, type GuideMap, type MapTheme } from './map';
import { Simulator, watchGps, type PositionSource, type SpeedProfile } from './position';
import { Narrator, type NarrationProgress } from './speech';
import { keepScreenOn } from './ui';

export interface MockUI {
    /** Nombre del mock, separa su Sesión y Escuchados de los demás. */
    name: string;
    theme: (dark: boolean) => MapTheme;
    /** Píxeles que ocupa la interfaz inferior, para que la cámara no esconda al usuario. */
    bottomInset(): number;
    onReady(app: MockApp): void;
    onAnnounce(poi: Poi): void;
    onExit(poi: Poi): void;
    onQueue(queue: Poi[]): void;
    onStates(): void;
    onFix(fix: Fix): void;
    onFollowChange(): void;
    /** `null` cuando no hay Narración en curso. */
    onNarration(poi: Poi | null, progress: NarrationProgress | null): void;
    onError(message: string): void;
    /** Cambió el POI seleccionado (toque en el mapa o `select`). */
    onSelect?(poi: Poi | null): void;
    /** El paseo simulado llegó al final de la ruta. */
    onSimEnd?(): void;
}

export class MockApp {
    pois: Poi[] = [];
    guide!: Guide;
    map!: GuideMap;
    follow!: Follow;
    narrator = new Narrator();
    sim: Simulator;
    source: 'sim' | 'gps' = 'sim';
    fix: Fix | null = null;
    selected: Poi | null = null;
    narrating: Poi | null = null;
    lang: Lang;
    dark: boolean;
    started = false;
    private gps: PositionSource | null = null;

    constructor(private readonly ui: MockUI) {
        this.lang = (localStorage.getItem(`btw-${ui.name}:lang`) as Lang) ?? (navigator.language.startsWith('es') ? 'es' : 'en');
        this.dark = localStorage.getItem(`btw-${ui.name}:dark`) === '1';
        this.sim = new Simulator(
            (fix) => this.onFix(fix),
            () => this.ui.onSimEnd?.(),
        );
    }

    async boot(container = 'map') {
        try {
            this.pois = await loadPois();
        } catch (e) {
            this.ui.onError((e as Error).message);
            return;
        }
        await this.narrator.init();
        this.guide = new Guide(this.pois, `btw-${this.ui.name}`, (poi) => this.narrator.say(this.text(poi).title, this.text(poi).lang));
        this.map = await createGuideMap(container, this.ui.theme(this.dark), { dark: this.dark, lang: this.lang });
        this.follow = new Follow(this.map.ml, () => this.ui.bottomInset());
        this.follow.onChange = () => this.ui.onFollowChange();

        this.guide.on('announce', (poi) => this.ui.onAnnounce(poi));
        this.guide.on('exit', (poi) => this.ui.onExit(poi));
        this.guide.on('queue', (q) => this.ui.onQueue(q));
        this.guide.on('states', () => this.redraw());

        this.narrator.onProgress = (p) => this.ui.onNarration(this.narrating, p);
        this.narrator.onEnd = () => {
            this.narrating = null;
            this.guide.endNarration();
            this.ui.onNarration(null, null);
        };

        this.map.onPoiClick((poi) => this.select(poi));
        this.map.onBackgroundClick(() => this.select(null));
        this.map.ml.once('load', () => this.redraw());
        this.redraw();
        this.ui.onReady(this);
    }

    /** Debe llamarse desde un toque: desbloquea la voz en iOS y pide pantalla encendida. */
    start() {
        this.narrator.unlock();
        keepScreenOn();
        this.started = true;
        if (this.source === 'sim') this.sim.start();
        else this.useGps();
    }

    text(poi: Poi) {
        return textFor(poi, this.lang);
    }

    distanceTo(poi: Poi) {
        return this.guide.distanceTo(poi, this.fix);
    }

    select(poi: Poi | null) {
        this.selected = poi;
        this.redraw();
        this.ui.onSelect?.(poi);
    }

    narrate(poi: Poi) {
        const { title, description, lang } = this.text(poi);
        this.narrating = poi;
        this.guide.startNarration(poi);
        this.narrator.narrate(title, description, lang);
        this.ui.onNarration(poi, this.narrator.progress);
    }

    pause() {
        this.narrator.pause();
    }

    resume() {
        this.narrator.resume();
    }

    stop() {
        this.narrator.stop();
    }

    setLang(lang: Lang) {
        this.lang = lang;
        localStorage.setItem(`btw-${this.ui.name}:lang`, lang);
        this.map?.setLanguage(lang);
        this.redraw();
    }

    setDark(dark: boolean) {
        this.dark = dark;
        localStorage.setItem(`btw-${this.ui.name}:dark`, dark ? '1' : '0');
        this.map?.setDark(dark, this.ui.theme(dark));
    }

    setProfile(profile: SpeedProfile) {
        this.sim.profile = profile;
    }

    toggleSim() {
        if (this.source !== 'sim') {
            this.gps?.stop();
            this.gps = null;
            this.source = 'sim';
        }
        if (this.sim.running) this.sim.stop();
        else this.sim.start();
    }

    useGps() {
        this.sim.stop();
        this.source = 'gps';
        this.gps?.stop();
        this.gps = watchGps(
            (fix) => this.onFix(fix),
            (msg) => this.ui.onError(msg),
        );
    }

    private onFix(fix: Fix) {
        this.fix = fix;
        this.map.setUser(fix);
        this.follow.update(fix);
        this.guide.update(fix);
        this.ui.onFix(fix);
    }

    private redraw() {
        if (!this.map) return;
        this.map.render(this.pois, (p) => this.guide.stateOf(p), this.lang, this.selected);
        this.ui.onStates();
    }
}
