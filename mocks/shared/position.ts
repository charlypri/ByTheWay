// Fuentes de posición para los mocks: GPS real o un paseo simulado por el Retiro.
import type { Fix } from './guide';

export type SpeedProfile = 'walk' | 'bike' | 'car';

/** km/h de cada perfil del simulador; cubren los tramos de zoom por velocidad. */
export const SPEEDS_KMH: Record<SpeedProfile, number> = { walk: 5, bike: 16, car: 40 };

// Puerta de la Independencia → Estanque → Palacio de Velázquez → Palacio de Cristal → Ángel Caído → Rosaleda.
const RETIRO_WALK: [number, number][] = [
    [-3.6883, 40.41985], [-3.68797, 40.41967], [-3.6872, 40.4199], [-3.68614, 40.42035],
    [-3.68607, 40.42018], [-3.68552, 40.41985], [-3.68502, 40.41947], [-3.6847, 40.4189],
    [-3.68444, 40.41833], [-3.6838, 40.4178], [-3.68307, 40.41731], [-3.6833, 40.4165],
    [-3.68346, 40.41573], [-3.6827, 40.41545], [-3.68196, 40.41517], [-3.6816, 40.4145],
    [-3.68129, 40.41396], [-3.68196, 40.4136], [-3.6818, 40.4128], [-3.68149, 40.412],
    [-3.682, 40.4115], [-3.68253, 40.41105], [-3.6815, 40.4109], [-3.68039, 40.41106],
    [-3.68032, 40.4108], [-3.6802, 40.41051],
];

export const SIM_START = RETIRO_WALK[0];

export interface PositionSource {
    stop(): void;
}

export function watchGps(onFix: (fix: Fix) => void, onError: (msg: string) => void): PositionSource {
    if (!('geolocation' in navigator)) {
        onError('Este navegador no da acceso a la ubicación');
        return { stop() {} };
    }
    const id = navigator.geolocation.watchPosition(
        (p) =>
            onFix({
                lon: p.coords.longitude,
                lat: p.coords.latitude,
                accuracy: p.coords.accuracy,
                speed: p.coords.speed,
                heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
                t: p.timestamp,
            }),
        (e) => onError(e.code === e.PERMISSION_DENIED ? 'Sin permiso de ubicación' : 'No se pudo obtener la ubicación'),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return { stop: () => navigator.geolocation.clearWatch(id) };
}

/**
 * Recorre la ruta a la velocidad del perfil, emitiendo una posición por segundo
 * con un poco de ruido GPS. `timeScale` acelera el reloj para no esperar 25 minutos.
 */
export class Simulator implements PositionSource {
    profile: SpeedProfile = 'walk';
    timeScale = 4;
    private timer: ReturnType<typeof setInterval> | null = null;
    private travelled = 0;
    private readonly segments = RETIRO_WALK.slice(1).map((b, i) => {
        const a = RETIRO_WALK[i];
        return { a, b, len: metres(a, b) };
    });

    constructor(private readonly onFix: (fix: Fix) => void, private readonly onEnd: () => void = () => {}) {}

    get running() {
        return this.timer !== null;
    }

    start() {
        if (this.timer) return;
        this.emit();
        this.timer = setInterval(() => this.tick(), 1000);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    restart() {
        this.stop();
        this.travelled = 0;
        this.start();
    }

    private tick() {
        this.travelled += (SPEEDS_KMH[this.profile] / 3.6) * this.timeScale;
        const total = this.segments.reduce((s, x) => s + x.len, 0);
        if (this.travelled >= total) {
            this.travelled = total;
            this.emit();
            this.stop();
            this.onEnd();
            return;
        }
        this.emit();
    }

    private emit() {
        let d = this.travelled;
        let seg = this.segments[0];
        for (const s of this.segments) {
            seg = s;
            if (d <= s.len) break;
            d -= s.len;
        }
        const f = seg.len ? Math.min(d / seg.len, 1) : 0;
        const lon = seg.a[0] + (seg.b[0] - seg.a[0]) * f;
        const lat = seg.a[1] + (seg.b[1] - seg.a[1]) * f;
        const jitter = () => (Math.random() - 0.5) * 0.00003; // ~±1,5 m
        this.onFix({
            lon: lon + jitter(),
            lat: lat + jitter(),
            accuracy: 6 + Math.random() * 6,
            speed: this.running ? SPEEDS_KMH[this.profile] / 3.6 : 0,
            heading: bearing(seg.a, seg.b),
            t: Date.now(),
        });
    }
}

function metres(a: [number, number], b: [number, number]) {
    const k = Math.cos((a[1] * Math.PI) / 180) * 111320;
    return Math.hypot((b[0] - a[0]) * k, (b[1] - a[1]) * 110540);
}

function bearing(a: [number, number], b: [number, number]) {
    const k = Math.cos((a[1] * Math.PI) / 180);
    return ((Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}
