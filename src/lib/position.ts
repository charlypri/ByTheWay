// Fuentes de posición. La app solo ve `PositionSource`, para poder cambiar el GPS del navegador
// por el simulador o por uno nativo sin tocar la lógica (ADR 0002).
import type { Fix } from './guide';
import { distanceM } from './kml';

export type PositionError = 'denied' | 'unavailable' | 'unsupported';

export interface PositionSource {
    start(onFix: (fix: Fix) => void, onError: (error: PositionError) => void): void;
    stop(): void;
}

/** Por debajo de esta distancia entre posiciones, el rumbo calculado es ruido. */
const MIN_MOVE_FOR_HEADING_M = 3;

export function bearingDeg(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
    const rad = Math.PI / 180;
    const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
    const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
    return ((Math.atan2(y, x) / rad) % 360 + 360) % 360;
}

/**
 * Completa el rumbo y la velocidad que el GPS no da con la posición anterior. Sin movimiento
 * suficiente se mantiene el último rumbo conocido, para que la flecha no gire sola.
 */
export function motionFiller() {
    let prev: Fix | null = null;
    let lastHeading: number | null = null;
    return (fix: Fix): Fix => {
        let { speed, heading } = fix;
        const moved = prev ? distanceM(prev, fix) : 0;
        const dt = prev ? (fix.t - prev.t) / 1000 : 0;
        if (speed == null && prev && dt > 0) speed = moved / dt;
        if (heading == null || !Number.isFinite(heading) || (speed ?? 0) < 0.3) {
            heading = prev && moved >= MIN_MOVE_FOR_HEADING_M ? bearingDeg(prev, fix) : lastHeading;
        }
        if (!prev || moved >= MIN_MOVE_FOR_HEADING_M || fix.heading != null) prev = fix;
        lastHeading = heading;
        return { ...fix, speed, heading };
    };
}

/** El GPS del navegador. */
export function browserGps(geolocation: Geolocation | undefined = globalThis.navigator?.geolocation): PositionSource {
    let id: number | null = null;
    return {
        start(onFix, onError) {
            if (!geolocation) return onError('unsupported');
            const fill = motionFiller();
            id = geolocation.watchPosition(
                (p) =>
                    onFix(
                        fill({
                            lon: p.coords.longitude,
                            lat: p.coords.latitude,
                            accuracy: p.coords.accuracy,
                            speed: p.coords.speed,
                            heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
                            t: p.timestamp,
                        }),
                    ),
                (e) => onError(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
            );
        },
        stop() {
            if (id != null) geolocation?.clearWatch(id);
            id = null;
        },
    };
}
