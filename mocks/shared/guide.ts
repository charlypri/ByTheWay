// Motor de la guía para los mocks: Entradas, Anuncios, Sesión y Escuchado.
// Implementa las reglas acordadas (ver CONTEXT.md); la versión de producción
// se construye en la Fase 1 con tests, pero el comportamiento debe ser el mismo.
import { distanceM, type Poi } from '../../src/lib/kml';

export interface Fix {
    lon: number;
    lat: number;
    /** metros */
    accuracy: number;
    /** m/s, null si el GPS no la da */
    speed: number | null;
    /** grados desde el norte, null si no hay rumbo */
    heading: number | null;
    t: number;
}

export type PoiState = 'pending' | 'announced' | 'heard' | 'playing';

export const RULES = {
    minEffectiveRadiusM: 15,
    maxAccuracyM: 50,
    fixesToConfirmEntry: 2,
    sessionTtlMs: 12 * 60 * 60 * 1000,
};

type GuideEvents = {
    /** Un POI se ha anunciado: la interfaz muestra su tarjeta. */
    announce: Poi;
    /** El usuario ha salido del Radio de acción de un POI. */
    exit: Poi;
    /** Cambió la cola de Anuncios pendientes. */
    queue: Poi[];
    /** Cambió el estado de algún POI (para repintar el mapa). */
    states: void;
};

export class Guide {
    private insideCount = new Map<string, number>();
    private inside = new Set<string>();
    private queue: Poi[] = [];
    private session: Record<string, number>;
    private heard: Set<string>;
    private playingId: string | null = null;
    private busy = false;
    private listeners: { [K in keyof GuideEvents]?: ((v: GuideEvents[K]) => void)[] } = {};

    constructor(
        readonly pois: Poi[],
        private readonly storageKey: string,
        /** Dice el título en voz alta; resuelve cuando termina. */
        private readonly speakTitle: (poi: Poi) => Promise<void>,
    ) {
        this.session = load(`${storageKey}:session`, {});
        this.heard = new Set(load<string[]>(`${storageKey}:heard`, []));
        this.pruneSession();
    }

    on<K extends keyof GuideEvents>(event: K, fn: (v: GuideEvents[K]) => void) {
        (this.listeners[event] ??= []).push(fn as never);
    }

    private emit<K extends keyof GuideEvents>(event: K, value: GuideEvents[K]) {
        this.listeners[event]?.forEach((fn) => fn(value));
    }

    stateOf(poi: Poi): PoiState {
        if (poi.id === this.playingId) return 'playing';
        if (this.heard.has(poi.id)) return 'heard';
        if (this.session[poi.id]) return 'announced';
        return 'pending';
    }

    isInside(poi: Poi) {
        return this.inside.has(poi.id);
    }

    get pending() {
        return [...this.queue];
    }

    distanceTo(poi: Poi, fix: Fix | null) {
        return fix ? distanceM(poi, fix) : null;
    }

    update(fix: Fix) {
        if (fix.accuracy > RULES.maxAccuracyM) return;
        this.pruneSession();
        const entries: Poi[] = [];
        for (const poi of this.pois) {
            const radius = Math.max(poi.radius, RULES.minEffectiveRadiusM);
            if (distanceM(poi, fix) <= radius) {
                const n = (this.insideCount.get(poi.id) ?? 0) + 1;
                this.insideCount.set(poi.id, n);
                if (n === RULES.fixesToConfirmEntry) {
                    this.inside.add(poi.id);
                    entries.push(poi);
                }
            } else if (this.insideCount.has(poi.id)) {
                this.insideCount.delete(poi.id);
                if (this.inside.delete(poi.id)) {
                    this.emit('exit', poi);
                    this.dequeue(poi);
                }
            }
        }
        // Con varias Entradas a la vez, primero el de radio mayor: contexto antes que detalle.
        entries
            .filter((poi) => this.stateOf(poi) === 'pending')
            .sort((a, b) => b.radius - a.radius)
            .forEach((poi) => this.queue.push(poi));
        if (entries.length) this.emit('queue', this.pending);
        void this.pump();
    }

    /** El usuario pide la Narración: el POI pasa a Escuchado en cuanto empieza. */
    startNarration(poi: Poi) {
        this.heard.add(poi.id);
        save(`${this.storageKey}:heard`, [...this.heard]);
        this.dequeue(poi);
        this.playingId = poi.id;
        this.busy = true;
        this.emit('states', undefined);
    }

    endNarration() {
        this.playingId = null;
        this.busy = false;
        this.emit('states', undefined);
        void this.pump();
    }

    resetSession() {
        this.session = {};
        save(`${this.storageKey}:session`, this.session);
        this.emit('states', undefined);
    }

    /** Empezar de cero: vacía la Sesión y olvida los Escuchados. */
    resetAll() {
        this.heard.clear();
        save(`${this.storageKey}:heard`, []);
        this.resetSession();
    }

    resetHeard() {
        this.heard.clear();
        save(`${this.storageKey}:heard`, []);
        this.emit('states', undefined);
    }

    private dequeue(poi: Poi) {
        const before = this.queue.length;
        this.queue = this.queue.filter((p) => p.id !== poi.id);
        if (this.queue.length !== before) this.emit('queue', this.pending);
    }

    private async pump(): Promise<void> {
        if (this.busy) return;
        const next = this.queue.shift();
        if (!next) return;
        this.emit('queue', this.pending);
        if (!this.inside.has(next.id) || this.stateOf(next) !== 'pending') return this.pump();
        this.busy = true;
        this.session[next.id] = Date.now();
        save(`${this.storageKey}:session`, this.session);
        this.emit('states', undefined);
        this.emit('announce', next);
        await this.speakTitle(next);
        // Si durante el título el usuario lanzó la Narración, la cola espera a que acabe.
        if (this.playingId) return;
        this.busy = false;
        void this.pump();
    }

    private pruneSession() {
        const now = Date.now();
        for (const [id, t] of Object.entries(this.session)) {
            if (now - t > RULES.sessionTtlMs) delete this.session[id];
        }
    }
}

function load<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function save(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // almacenamiento no disponible (modo privado): la Sesión vive solo en memoria
    }
}
