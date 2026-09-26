import { describe, expect, it } from 'vitest';
import { isNight, shouldBeDark, sunTimesUtc } from './daylight';

const MADRID = { lat: 40.4168, lon: -3.7038 };
const TROMSO = { lat: 69.65, lon: 18.96 };
const utc = (iso: string) => new Date(`${iso}Z`);
const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

describe('sunTimesUtc', () => {
    it('da el amanecer y el atardecer de Madrid con un par de minutos de error', () => {
        // Referencia: solsticio de verano, 6:45 y 21:48 hora local (UTC+2).
        const june = sunTimesUtc(utc('2026-06-21T12:00'), MADRID.lat, MADRID.lon)!;
        expect(Math.abs(june.rise - (4 + 45 / 60)) * 60).toBeLessThan(4);
        expect(Math.abs(june.set - (19 + 48 / 60)) * 60).toBeLessThan(4);
        // Solsticio de invierno, 8:33 y 17:53 hora local (UTC+1).
        const dec = sunTimesUtc(utc('2026-12-21T12:00'), MADRID.lat, MADRID.lon)!;
        expect(hm(dec.rise)).toMatch(/^7:3\d$/);
        expect(hm(dec.set)).toMatch(/^16:5\d$/);
    });

    it('no hay amanecer en la noche polar', () => {
        expect(sunTimesUtc(utc('2026-12-21T12:00'), TROMSO.lat, TROMSO.lon)).toBeNull();
    });
});

describe('isNight', () => {
    it('es de noche del atardecer al amanecer', () => {
        expect(isNight(utc('2026-09-26T12:00'), MADRID.lat, MADRID.lon)).toBe(false);
        expect(isNight(utc('2026-09-26T21:00'), MADRID.lat, MADRID.lon)).toBe(true);
        expect(isNight(utc('2026-09-26T03:00'), MADRID.lat, MADRID.lon)).toBe(true);
    });

    it('en los polos, el invierno es noche y el verano día', () => {
        expect(isNight(utc('2026-12-21T12:00'), TROMSO.lat, TROMSO.lon)).toBe(true);
        expect(isNight(utc('2026-06-21T00:00'), TROMSO.lat, TROMSO.lon)).toBe(false);
    });
});

describe('shouldBeDark', () => {
    it('manda el sistema; si no, la hora en la posición del usuario', () => {
        const noon = utc('2026-09-26T12:00');
        expect(shouldBeDark(true, MADRID, noon)).toBe(true);
        expect(shouldBeDark(false, MADRID, noon)).toBe(false);
        expect(shouldBeDark(false, MADRID, utc('2026-09-26T22:00'))).toBe(true);
        expect(shouldBeDark(false, null, utc('2026-09-26T22:00'))).toBe(false);
    });
});
