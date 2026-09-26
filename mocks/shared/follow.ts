// Modo seguimiento: la cámara sigue al usuario con zoom según la velocidad,
// como los navegadores de coche. Norte arriba andando, rumbo arriba desde 15 km/h.
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Fix } from './guide';

interface Band {
    name: 'walk' | 'bike' | 'urban' | 'road';
    /** km/h a partir de los que se entra en este tramo */
    from: number;
    zoom: number;
}

export const BANDS: Band[] = [
    { name: 'walk', from: 0, zoom: 18 },
    { name: 'bike', from: 6, zoom: 16.5 },
    { name: 'urban', from: 25, zoom: 15 },
    { name: 'road', from: 60, zoom: 13.5 },
];

const HYSTERESIS_KMH = 1.5;
const HEADING_UP_ON_KMH = 15;
const HEADING_UP_OFF_KMH = 12;

/** Tramo de zoom con histéresis para que no oscile en los límites. */
export function nextBand(current: number, kmh: number): number {
    let i = current;
    while (i < BANDS.length - 1 && kmh >= BANDS[i + 1].from + HYSTERESIS_KMH) i++;
    while (i > 0 && kmh < BANDS[i].from - HYSTERESIS_KMH) i--;
    return i;
}

/** Inclinación de la cámara en 3D. */
export const PITCH_3D = 55;

export type TiltMode = 'auto' | '3d' | '2d';

export class Follow {
    active = true;
    /** `auto`: 3D a pie y plano a más velocidad. `3d`/`2d`: lo que eligió el usuario. */
    tilt: TiltMode = '2d';
    headingUp = false;
    northLocked = false;
    band = 0;
    onChange: () => void = () => {};
    private last: Fix | null = null;

    constructor(private readonly map: MapLibreMap, private readonly bottomInset: () => number = () => 0) {
        // Mover el mapa con el dedo abandona el seguimiento; solo se recupera con Recentrar.
        const leave = (e: { originalEvent?: unknown }) => {
            if (e.originalEvent && this.active) {
                this.active = false;
                this.onChange();
            }
        };
        map.on('dragstart', leave);
        map.on('zoomstart', leave);
        map.on('rotatestart', leave);
    }

    get pitched() {
        return this.tilt === '3d' || (this.tilt === 'auto' && BANDS[this.band].name === 'walk');
    }

    /** El toggle fija lo contrario de lo que se ve ahora, a cualquier velocidad. */
    toggleTilt() {
        this.tilt = this.pitched ? '2d' : '3d';
        this.onChange();
        if (this.active) this.move(600);
        else this.map.easeTo({ pitch: this.pitched ? PITCH_3D : 0, duration: 600 });
    }

    get kmh() {
        return this.last?.speed != null ? this.last.speed * 3.6 : 0;
    }

    update(fix: Fix) {
        this.last = fix;
        const kmh = this.kmh;
        const band = nextBand(this.band, kmh);
        const headingUp = this.northLocked
            ? false
            : this.headingUp
              ? kmh >= HEADING_UP_OFF_KMH
              : kmh >= HEADING_UP_ON_KMH;
        const wasPitched = this.pitched;
        const changed = band !== this.band || headingUp !== this.headingUp;
        this.band = band;
        this.headingUp = headingUp;
        if (changed || wasPitched !== this.pitched) this.onChange();
        if (this.active) this.move(900);
    }

    /** Deja de seguir sin que el usuario haya movido el mapa (p. ej. al abrir una ficha). */
    suspend() {
        if (!this.active) return;
        this.active = false;
        this.onChange();
    }

    recenter() {
        this.active = true;
        this.onChange();
        this.move(600);
    }

    toggleNorth() {
        this.northLocked = !this.northLocked;
        if (this.northLocked) this.headingUp = false;
        this.onChange();
        if (this.active) this.move(500);
        else this.map.easeTo({ bearing: 0, duration: 500 });
    }

    private move(duration: number) {
        if (!this.last) return;
        const inset = this.bottomInset();
        this.map.easeTo({
            center: [this.last.lon, this.last.lat],
            zoom: BANDS[this.band].zoom,
            bearing: this.headingUp && this.last.heading != null ? this.last.heading : 0,
            pitch: this.pitched ? PITCH_3D : 0,
            // Rumbo arriba: el usuario se coloca en el tercio inferior para ver lo que viene.
            padding: { top: this.headingUp ? inset * 0.2 + 160 : 0, bottom: inset, left: 0, right: 0 },
            duration,
            easing: (t) => t * (2 - t),
        });
    }
}
