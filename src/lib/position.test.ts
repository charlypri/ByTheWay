import { describe, expect, it, vi } from 'vitest';
import type { Fix } from './guide';
import { bearingDeg, browserGps, motionFiller } from './position';

const M = 1 / 111_195;
const fix = (north: number, east: number, t: number, extra: Partial<Fix> = {}): Fix => ({
    lat: 40.4 + north * M,
    lon: -3.7 + (east * M) / Math.cos((40.4 * Math.PI) / 180),
    accuracy: 5,
    speed: null,
    heading: null,
    t,
    ...extra,
});

describe('bearingDeg', () => {
    it('mide el rumbo desde el norte en sentido horario', () => {
        expect(bearingDeg(fix(0, 0, 0), fix(10, 0, 0))).toBeCloseTo(0, 0);
        expect(bearingDeg(fix(0, 0, 0), fix(0, 10, 0))).toBeCloseTo(90, 0);
        expect(bearingDeg(fix(0, 0, 0), fix(-10, 0, 0))).toBeCloseTo(180, 0);
        expect(bearingDeg(fix(0, 0, 0), fix(0, -10, 0))).toBeCloseTo(270, 0);
    });
});

describe('motionFiller', () => {
    it('calcula rumbo y velocidad con la posición anterior cuando el GPS no los da', () => {
        const fill = motionFiller();
        fill(fix(0, 0, 0));
        const f = fill(fix(0, 10, 5000));
        expect(f.heading).toBeCloseTo(90, 0);
        expect(f.speed).toBeCloseTo(2, 1);
    });

    it('respeta el rumbo del GPS si se está moviendo', () => {
        const fill = motionFiller();
        fill(fix(0, 0, 0, { speed: 2, heading: 45 }));
        expect(fill(fix(0, 10, 1000, { speed: 2, heading: 45 })).heading).toBe(45);
    });

    it('parado, mantiene el último rumbo y no gira con el ruido', () => {
        const fill = motionFiller();
        fill(fix(0, 0, 0));
        fill(fix(10, 0, 5000));
        const jitter = fill(fix(10, 1, 6000, { speed: 0, heading: 250 }));
        expect(jitter.heading).toBeCloseTo(0, 0);
    });

    it('sin posición anterior no inventa el rumbo', () => {
        expect(motionFiller()(fix(0, 0, 0)).heading).toBeNull();
    });
});

describe('browserGps', () => {
    it('traduce las posiciones del navegador y los errores de permiso', () => {
        let ok: PositionCallback = () => {};
        let ko: PositionErrorCallback = () => {};
        const geo = {
            watchPosition: vi.fn((a: PositionCallback, b: PositionErrorCallback) => {
                ok = a;
                ko = b;
                return 7;
            }),
            clearWatch: vi.fn(),
        } as unknown as Geolocation;
        const fixes: Fix[] = [];
        const errors: string[] = [];
        const gps = browserGps(geo);
        gps.start(
            (f) => fixes.push(f),
            (e) => errors.push(e),
        );
        ok({ coords: { latitude: 40.4, longitude: -3.7, accuracy: 9, speed: null, heading: NaN }, timestamp: 1 } as unknown as GeolocationPosition);
        ko({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        gps.stop();
        expect(fixes[0]).toMatchObject({ lat: 40.4, lon: -3.7, accuracy: 9, heading: null, t: 1 });
        expect(errors).toEqual(['denied']);
        expect(geo.clearWatch).toHaveBeenCalledWith(7);
    });

    it('sin geolocalización lo dice', () => {
        const errors: string[] = [];
        browserGps(undefined).start(
            () => {},
            (e) => errors.push(e),
        );
        expect(errors).toEqual(['unsupported']);
    });
});
