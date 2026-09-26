// Simulador de paseo (?sim): una fuente de posición que recorre una ruta de ejemplo por el Retiro
// con ruido GPS, se puede arrastrar en el mapa y se puede cambiar por el GPS real sin recargar.
import type { Fix } from './guide';
import { distanceM } from './kml';
import { bearingDeg, type PositionError, type PositionSource } from './position';

export type SpeedProfile = 'walk' | 'bike' | 'car';

/** km/h de cada perfil; cubren los tramos de zoom por velocidad. */
export const SPEEDS_KMH: Record<SpeedProfile, number> = { walk: 5, bike: 16, car: 40 };
export const TIME_SCALES = [1, 4, 10] as const;

// Puerta de la Independencia → Estanque → Palacio de Velázquez → Palacio de Cristal → Ángel Caído → Rosaleda.
export const RETIRO_WALK: [number, number][] = [
    [-3.6883, 40.41985], [-3.68797, 40.41967], [-3.6872, 40.4199], [-3.68614, 40.42035],
    [-3.68607, 40.42018], [-3.68552, 40.41985], [-3.68502, 40.41947], [-3.6847, 40.4189],
    [-3.68444, 40.41833], [-3.6838, 40.4178], [-3.68307, 40.41731], [-3.6833, 40.4165],
    [-3.68346, 40.41573], [-3.6827, 40.41545], [-3.68196, 40.41517], [-3.6816, 40.4145],
    [-3.68129, 40.41396], [-3.68196, 40.4136], [-3.6818, 40.4128], [-3.68149, 40.412],
    [-3.682, 40.4115], [-3.68253, 40.41105], [-3.6815, 40.4109], [-3.68039, 40.41106],
    [-3.68032, 40.4108], [-3.6802, 40.41051],
];

const TICK_MS = 1000;
/** ±1,5 m de ruido en cada eje, como un GPS bueno a cielo abierto. */
const NOISE_DEG = 0.00003;

export interface SimulatorDeps {
    now(): number;
    every(fn: () => void, ms: number): () => void;
    random(): number;
    /** El GPS real, para cambiar a él desde el panel del simulador. */
    gps: PositionSource;
    route?: [number, number][];
}

export class Simulator implements PositionSource {
    profile: SpeedProfile = 'walk';
    timeScale: number = 4;
    source: 'sim' | 'gps' = 'sim';
    /** Metros recorridos sobre la ruta. */
    private travelled = 0;
    /** Posición fijada al arrastrar la flecha; manda sobre la ruta hasta volver a andar. */
    private dropped: { lon: number; lat: number } | null = null;
    private stopTimer: (() => void) | null = null;
    private onFix: (fix: Fix) => void = () => {};
    private onError: (e: PositionError) => void = () => {};
    private listeners = new Set<() => void>();
    private readonly segments: { a: [number, number]; b: [number, number]; len: number }[];

    constructor(private readonly deps: SimulatorDeps) {
        const route = deps.route ?? RETIRO_WALK;
        this.segments = route.slice(1).map((b, i) => {
            const a = route[i];
            return { a, b, len: distanceM({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] }) };
        });
    }

    get length() {
        return this.segments.reduce((s, x) => s + x.len, 0);
    }

    get walking() {
        return this.source === 'sim' && this.stopTimer !== null && !this.dropped;
    }

    get travelledM() {
        return this.travelled;
    }

    get finished() {
        return this.travelled >= this.length;
    }

    /** Avisa a la interfaz del simulador cuando cambia su estado. */
    onChange(fn: () => void) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    start(onFix: (fix: Fix) => void, onError: (e: PositionError) => void) {
        this.onFix = onFix;
        this.onError = onError;
        this.play();
    }

    stop() {
        this.stopTimer?.();
        this.stopTimer = null;
        this.deps.gps.stop();
        this.changed();
    }

    /** Andar por la ruta desde donde se quedó. */
    play() {
        if (this.source === 'gps') {
            this.deps.gps.stop();
            this.source = 'sim';
        }
        this.dropped = null;
        if (this.finished) this.travelled = 0;
        this.emit();
        this.stopTimer ??= this.deps.every(() => this.tick(), TICK_MS);
        this.changed();
    }

    pause() {
        this.stopTimer?.();
        this.stopTimer = null;
        this.changed();
    }

    restart() {
        this.travelled = 0;
        this.play();
    }

    /** La flecha arrastrada a mano: posiciones paradas en ese punto, una por segundo. */
    moveTo(lon: number, lat: number) {
        if (this.source === 'gps') return;
        this.dropped = { lon, lat };
        this.emit();
        this.stopTimer ??= this.deps.every(() => this.tick(), TICK_MS);
        this.changed();
    }

    useGps() {
        this.pause();
        this.source = 'gps';
        this.deps.gps.start(this.onFix, this.onError);
        this.changed();
    }

    private tick() {
        if (!this.dropped) {
            this.travelled = Math.min(this.length, this.travelled + (SPEEDS_KMH[this.profile] / 3.6) * (TICK_MS / 1000) * this.timeScale);
        }
        this.emit();
        if (!this.dropped && this.finished) this.pause();
    }

    private emit() {
        const noise = () => (this.deps.random() - 0.5) * NOISE_DEG;
        const accuracy = 6 + this.deps.random() * 6;
        if (this.dropped) {
            this.onFix({ ...this.dropped, accuracy, speed: 0, heading: null, t: this.deps.now() });
            return;
        }
        const { lon, lat, heading } = this.pointAt(this.travelled);
        const moving = this.stopTimer !== null && !this.finished;
        this.onFix({ lon: lon + noise(), lat: lat + noise(), accuracy, speed: moving ? SPEEDS_KMH[this.profile] / 3.6 : 0, heading, t: this.deps.now() });
    }

    private pointAt(d: number) {
        let rest = d;
        let seg = this.segments[0];
        for (const s of this.segments) {
            seg = s;
            if (rest <= s.len) break;
            rest -= s.len;
        }
        const f = seg.len ? Math.min(rest / seg.len, 1) : 0;
        const from = { lon: seg.a[0], lat: seg.a[1] };
        const to = { lon: seg.b[0], lat: seg.b[1] };
        return { lon: from.lon + (to.lon - from.lon) * f, lat: from.lat + (to.lat - from.lat) * f, heading: bearingDeg(from, to) };
    }

    private changed() {
        this.listeners.forEach((fn) => fn());
    }
}
