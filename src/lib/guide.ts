// Motor de la guía: Entradas, Anuncios, Sesión y Escuchados (CONTEXT.md y sección 3 de la especificación).
// No sabe nada de la interfaz ni del audio: dice los títulos con `announce` y avisa con eventos.
import { Emitter } from './emitter';
import { distanceM, type Poi } from './kml';
import type { KeyValueStore } from './storage';

export interface Fix {
    lon: number;
    lat: number;
    /** metros */
    accuracy: number;
    /** m/s, null si el GPS no la da */
    speed: number | null;
    /** grados desde el norte, null si no hay rumbo */
    heading: number | null;
    /** ms desde epoch */
    t: number;
}

/** por escuchar · anunciado (en la Sesión) · escuchado · sonando (Narración en curso). */
export type PoiState = 'pending' | 'announced' | 'heard' | 'playing';

export const RULES = {
    minEffectiveRadiusM: 15,
    maxAccuracyM: 50,
    fixesToConfirmEntry: 2,
    sessionTtlMs: 12 * 60 * 60_000,
} as const;

export interface GuideDeps {
    store: KeyValueStore;
    now(): number;
    /** Dice el título del POI en voz alta; resuelve cuando termina o se corta. */
    announce(poi: Poi): Promise<void>;
}

type GuideEvents = {
    /** Un POI se ha anunciado: la interfaz muestra su tarjeta. */
    announce: Poi;
    /** El usuario ha salido del Radio de acción de un POI en el que había entrado. */
    exit: Poi;
    /** Cambió la cola de Anuncios que esperan su turno. */
    queue: Poi[];
    /** Cambió el estado de algún POI: hay que repintar el mapa. */
    states: void;
};

const SESSION_KEY = 'session';
const HEARD_KEY = 'heard';

export class Guide extends Emitter<GuideEvents> {
    pois: Poi[];
    /** Posiciones seguidas dentro del radio de cada POI. */
    private streak = new Map<string, number>();
    /** POIs con la Entrada confirmada y de los que aún no se ha salido. */
    private inside = new Set<string>();
    private queue: Poi[] = [];
    /** Momento del Anuncio de cada POI de la Sesión. */
    private session: Record<string, number>;
    private heard: Set<string>;
    private playingId: string | null = null;
    /** Suena un título o una Narración: los Anuncios esperan. */
    private busy = false;

    constructor(pois: Poi[], private readonly deps: GuideDeps) {
        super();
        this.pois = pois;
        this.session = deps.store.get<Record<string, number>>(SESSION_KEY) ?? {};
        this.heard = new Set(deps.store.get<string[]>(HEARD_KEY) ?? []);
        this.prune();
    }

    stateOf(poi: Poi): PoiState {
        if (poi.id === this.playingId) return 'playing';
        if (this.heard.has(poi.id)) return 'heard';
        if (this.inSession(poi.id)) return 'announced';
        return 'pending';
    }

    isInside(poi: Poi) {
        return this.inside.has(poi.id);
    }

    /** Anuncios que esperan su turno, en orden. */
    get pending(): Poi[] {
        return [...this.queue];
    }

    /** Una versión nueva del catálogo: el estado de cada POI sigue a su identidad (sus coordenadas). */
    setPois(pois: Poi[]) {
        this.pois = pois;
        const ids = new Set(pois.map((p) => p.id));
        for (const id of [...this.streak.keys()]) if (!ids.has(id)) this.streak.delete(id);
        for (const id of [...this.inside]) if (!ids.has(id)) this.inside.delete(id);
        const byId = new Map(pois.map((p) => [p.id, p]));
        const queue = this.queue.flatMap((p) => byId.get(p.id) ?? []);
        if (queue.length !== this.queue.length) {
            this.queue = queue;
            this.emit('queue', this.pending);
        } else this.queue = queue;
        this.emit('states', undefined);
    }

    update(fix: Fix) {
        if (!(fix.accuracy <= RULES.maxAccuracyM)) return;
        const entries: Poi[] = [];
        for (const poi of this.pois) {
            const radius = Math.max(poi.radius, RULES.minEffectiveRadiusM);
            if (distanceM(poi, fix) <= radius) {
                const n = (this.streak.get(poi.id) ?? 0) + 1;
                this.streak.set(poi.id, n);
                if (n === RULES.fixesToConfirmEntry) {
                    this.inside.add(poi.id);
                    entries.push(poi);
                }
            } else if (this.streak.delete(poi.id) && this.inside.delete(poi.id)) {
                this.emit('exit', poi);
                this.dequeue(poi);
            }
        }
        if (!entries.length) return;
        // Con varias Entradas a la vez, primero el de radio mayor: el contexto antes que el detalle.
        const fresh = entries.filter((p) => this.stateOf(p) === 'pending').sort((a, b) => b.radius - a.radius);
        if (!fresh.length) return;
        this.queue.push(...fresh);
        this.emit('queue', this.pending);
        void this.pump();
    }

    /** El usuario pide la Narración: el POI pasa a Escuchado en cuanto empieza. */
    startNarration(poi: Poi) {
        this.heard.add(poi.id);
        this.deps.store.set(HEARD_KEY, [...this.heard]);
        this.dequeue(poi);
        this.playingId = poi.id;
        this.busy = true;
        this.emit('states', undefined);
    }

    /** La Narración ha terminado o se ha parado: sigue la cola. */
    endNarration() {
        if (!this.playingId) return;
        this.playingId = null;
        this.busy = false;
        this.emit('states', undefined);
        void this.pump();
    }

    /** Empezar de cero: vacía la Sesión y olvida los Escuchados. */
    startOver() {
        this.session = {};
        this.heard.clear();
        this.deps.store.set(SESSION_KEY, this.session);
        this.deps.store.set(HEARD_KEY, []);
        this.emit('states', undefined);
    }

    private inSession(id: string) {
        const t = this.session[id];
        return t != null && this.deps.now() - t < RULES.sessionTtlMs;
    }

    private dequeue(poi: Poi) {
        const before = this.queue.length;
        this.queue = this.queue.filter((p) => p.id !== poi.id);
        if (this.queue.length !== before) this.emit('queue', this.pending);
    }

    private async pump(): Promise<void> {
        while (!this.busy) {
            const next = this.queue.shift();
            if (!next) return;
            this.emit('queue', this.pending);
            // Salió del radio o ya se narró mientras esperaba: se descarta.
            if (!this.inside.has(next.id) || this.stateOf(next) !== 'pending') continue;
            this.busy = true;
            this.prune();
            this.session[next.id] = this.deps.now();
            this.deps.store.set(SESSION_KEY, this.session);
            this.emit('states', undefined);
            this.emit('announce', next);
            try {
                await this.deps.announce(next);
            } catch {
                // sin voz: el Anuncio queda en la tarjeta
            }
            // Si durante el título el usuario lanzó una Narración, la cola espera a que acabe.
            if (this.playingId) return;
            this.busy = false;
        }
    }

    /** Olvida los Anuncios de hace más de 12 h para que la Sesión guardada no crezca sin fin. */
    private prune() {
        const now = this.deps.now();
        for (const [id, t] of Object.entries(this.session)) {
            if (now - t >= RULES.sessionTtlMs) delete this.session[id];
        }
    }
}
