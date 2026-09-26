import { describe, expect, it, vi } from 'vitest';
import { BANDS, FollowCamera, nextBand, PITCH_3D, type CameraMove } from './follow';
import type { Fix } from './guide';

const kmh = (v: number, heading: number | null = 90): Fix => ({ lon: -3.684, lat: 40.418, accuracy: 5, speed: v / 3.6, heading, t: 0 });

function setup(inset = 0) {
    const moves: CameraMove[] = [];
    let gesture: () => void = () => {};
    const cam = new FollowCamera({ move: (m) => moves.push(m), onGesture: (fn) => (gesture = fn) }, () => inset);
    const change = vi.fn();
    cam.on('change', change);
    return { cam, moves, change, gesture: () => gesture(), last: () => moves.at(-1)! };
}

/** Lleva la cámara a una velocidad, con varias posiciones para atravesar tramos. */
const drive = (cam: FollowCamera, ...speeds: number[]) => speeds.forEach((v) => cam.update(kmh(v)));

describe('zoom por velocidad', () => {
    it('cada tramo tiene su zoom', () => {
        expect([3, 16, 40, 90].map((v) => BANDS[nextBand(0, v)].zoom)).toEqual([18, 16.5, 15, 13.5]);
    });

    it('cambia de tramo con histéresis de 1,5 km/h', () => {
        expect(nextBand(0, 7)).toBe(0);
        expect(nextBand(0, 7.5)).toBe(1);
        expect(nextBand(1, 5)).toBe(1);
        expect(nextBand(1, 4.4)).toBe(0);
    });

    it('sigue al usuario con transición suave', () => {
        const { cam, last } = setup();
        drive(cam, 16);
        expect(last()).toMatchObject({ center: [-3.684, 40.418], zoom: 16.5, duration: 900 });
    });
});

describe('orientación', () => {
    it('norte arriba a pie; rumbo arriba desde 15 km/h y vuelta al norte por debajo de 12', () => {
        const { cam, last } = setup();
        drive(cam, 5);
        expect(last().bearing).toBe(0);
        drive(cam, 14);
        expect(cam.headingUp).toBe(false);
        drive(cam, 15);
        expect(last().bearing).toBe(90);
        drive(cam, 12.5);
        expect(cam.headingUp).toBe(true);
        drive(cam, 11.9);
        expect(last().bearing).toBe(0);
    });

    it('en rumbo arriba el usuario baja al tercio inferior', () => {
        const { cam, last } = setup(200);
        drive(cam, 30);
        expect(last().padding).toEqual({ top: 200, bottom: 200, left: 0, right: 0 });
    });

    it('sin rumbo conocido se queda con el norte arriba', () => {
        const { cam, last } = setup();
        cam.update(kmh(30, null));
        expect(last().bearing).toBe(0);
    });

    it('la brújula fija el norte a cualquier velocidad y otro toque lo desbloquea', () => {
        const { cam, last } = setup();
        drive(cam, 30);
        cam.toggleNorth();
        expect(last().bearing).toBe(0);
        drive(cam, 40);
        expect(last().bearing).toBe(0);
        cam.toggleNorth();
        drive(cam, 40);
        expect(last().bearing).toBe(90);
    });
});

describe('3D', () => {
    it('a pie la cámara se inclina 55° y en bici o coche va en plano', () => {
        const { cam, last } = setup();
        drive(cam, 4);
        expect(last().pitch).toBe(PITCH_3D);
        drive(cam, 20);
        expect(last().pitch).toBe(0);
    });

    it('el botón fija lo contrario de lo que se ve, a cualquier velocidad', () => {
        const { cam, last } = setup();
        drive(cam, 4);
        cam.toggleTilt();
        expect(cam.tilt).toBe('2d');
        drive(cam, 4);
        expect(last().pitch).toBe(0);

        drive(cam, 20, 30);
        cam.toggleTilt();
        expect(cam.tilt).toBe('3d');
        expect(last().pitch).toBe(PITCH_3D);
    });

    it('volver a tocarlo cuando coincide con lo automático vuelve al automático', () => {
        const { cam } = setup();
        drive(cam, 4);
        cam.toggleTilt();
        cam.toggleTilt();
        expect(cam.tilt).toBe('auto');
        drive(cam, 20);
        expect(cam.pitched).toBe(false);
    });

    it('avisa a la interfaz cuando cambia la inclinación', () => {
        const { cam, change } = setup();
        drive(cam, 4);
        change.mockClear();
        drive(cam, 20);
        expect(change).toHaveBeenCalled();
    });
});

describe('salir y volver', () => {
    it('un gesto con los dedos abandona el seguimiento, que no vuelve solo', () => {
        const { cam, moves, gesture } = setup();
        drive(cam, 4);
        gesture();
        expect(cam.active).toBe(false);
        const n = moves.length;
        drive(cam, 4, 4, 4);
        expect(moves).toHaveLength(n);
    });

    it('Recentrar lo recupera con una animación de 600 ms', () => {
        const { cam, last, gesture } = setup();
        drive(cam, 4);
        gesture();
        cam.recenter();
        expect(cam.active).toBe(true);
        expect(last().duration).toBe(600);
    });

    it('la inclinación y el norte cambian aunque no se siga al usuario', () => {
        const { cam, last, gesture } = setup();
        drive(cam, 4);
        gesture();
        cam.toggleTilt();
        expect(last()).toEqual({ pitch: 0, duration: 600 });
        cam.toggleNorth();
        expect(last()).toEqual({ bearing: 0, duration: 600 });
    });

    it('reencuadra cuando cambia lo que tapa la interfaz', () => {
        let inset = 0;
        const moves: CameraMove[] = [];
        const cam = new FollowCamera({ move: (m) => moves.push(m), onGesture: () => {} }, () => inset);
        drive(cam, 4);
        inset = 180;
        cam.reframe();
        expect(moves.at(-1)?.padding?.bottom).toBe(180);
    });
});
