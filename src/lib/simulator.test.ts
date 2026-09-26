import { describe, expect, it, vi } from 'vitest';
import type { Fix } from './guide';
import { distanceM } from './kml';
import type { PositionSource } from './position';
import { RETIRO_WALK, Simulator, SPEEDS_KMH } from './simulator';

function setup(route?: [number, number][]) {
    let tick: (() => void) | null = null;
    const gps = {
        emit: (_f: Fix) => {},
        start: vi.fn((onFix: (f: Fix) => void) => {
            gps.emit = onFix;
        }),
        stop: vi.fn(),
    } satisfies PositionSource & { emit(f: Fix): void };
    const sim = new Simulator({
        now: () => 0,
        every: (fn) => {
            tick = fn;
            return () => (tick = null);
        },
        random: () => 0.5, // sin ruido
        gps,
        route,
    });
    const fixes: Fix[] = [];
    sim.start(
        (f) => fixes.push(f),
        () => {},
    );
    return { sim, fixes, gps, tick: (n = 1) => Array.from({ length: n }, () => tick?.()), ticking: () => tick !== null };
}

const START = { lon: RETIRO_WALK[0][0], lat: RETIRO_WALK[0][1] };

describe('Simulator', () => {
    it('empieza en el inicio de la ruta y avanza a la velocidad del perfil', () => {
        const { sim, fixes, tick } = setup();
        expect(distanceM(fixes[0], START)).toBeLessThan(0.5);
        sim.timeScale = 1;
        tick(10);
        expect(distanceM(fixes.at(-1)!, START)).toBeCloseTo((SPEEDS_KMH.walk / 3.6) * 10, 0);
        expect(fixes.at(-1)!.speed).toBeCloseTo(SPEEDS_KMH.walk / 3.6);
    });

    it('el reloj acelerado recorre más ruta sin cambiar la velocidad que ve la cámara', () => {
        const { sim, fixes, tick } = setup([
            [-3.7, 40.4],
            [-3.7, 40.41],
        ]);
        sim.profile = 'bike';
        sim.timeScale = 10;
        tick(1);
        expect(distanceM(fixes.at(-1)!, { lon: -3.7, lat: 40.4 })).toBeCloseTo((16 / 3.6) * 10, 0);
        expect(fixes.at(-1)!.speed! * 3.6).toBeCloseTo(16);
    });

    it('da el rumbo del tramo y un ruido de GPS pequeño', () => {
        const { fixes } = setup([
            [-3.7, 40.4],
            [-3.7, 40.41],
        ]);
        expect(fixes[0].heading).toBeCloseTo(0, 0);
        expect(fixes[0].accuracy).toBeGreaterThanOrEqual(6);
        expect(fixes[0].accuracy).toBeLessThanOrEqual(12);
    });

    it('se para al final de la ruta y Andar vuelve a empezar', () => {
        const { sim, fixes, tick, ticking } = setup();
        sim.timeScale = 10;
        tick(1000);
        expect(sim.finished).toBe(true);
        expect(ticking()).toBe(false);
        expect(fixes.at(-1)!.speed).toBe(0);
        sim.play();
        expect(distanceM(fixes.at(-1)!, START)).toBeLessThan(0.5);
    });

    it('la flecha arrastrada da posiciones paradas en ese punto hasta volver a andar', () => {
        const { sim, fixes, tick } = setup();
        sim.moveTo(-3.684, 40.418);
        tick(2);
        expect(fixes.slice(-3).every((f) => f.lon === -3.684 && f.lat === 40.418 && f.speed === 0)).toBe(true);
        expect(sim.walking).toBe(false);
        sim.play();
        expect(distanceM(fixes.at(-1)!, START)).toBeLessThan(0.5);
    });

    it('cambia al GPS real y vuelve al simulador', () => {
        const { sim, fixes, gps, ticking } = setup();
        sim.useGps();
        expect(ticking()).toBe(false);
        expect(gps.start).toHaveBeenCalled();
        gps.emit({ lon: 1, lat: 2, accuracy: 5, speed: 0, heading: null, t: 0 });
        expect(fixes.at(-1)!.lon).toBe(1);
        sim.play();
        expect(gps.stop).toHaveBeenCalled();
        expect(sim.source).toBe('sim');
    });
});
