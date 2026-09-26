// Modo seguimiento (sección 6): la cámara sigue al usuario con el zoom según su velocidad, como un
// navegador de coche. Norte arriba andando y rumbo arriba desde 15 km/h; 3D a pie y plano más rápido.
// La cámara real queda detrás de `CameraPort`, para probar las reglas sin mapa.
import { Emitter } from './emitter';
import type { Fix } from './guide';

export interface Band {
    name: 'walk' | 'bike' | 'urban' | 'road';
    /** km/h a partir de los que se entra en este tramo */
    from: number;
    zoom: number;
}

export const BANDS: readonly Band[] = [
    { name: 'walk', from: 0, zoom: 18 },
    { name: 'bike', from: 6, zoom: 16.5 },
    { name: 'urban', from: 25, zoom: 15 },
    { name: 'road', from: 60, zoom: 13.5 },
];

export const HYSTERESIS_KMH = 1.5;
export const HEADING_UP_ON_KMH = 15;
export const HEADING_UP_OFF_KMH = 12;
export const PITCH_3D = 55;
const FOLLOW_MS = 900;
const RECENTER_MS = 600;

/** Tramo de zoom con histéresis, para que no oscile en los límites. */
export function nextBand(current: number, kmh: number): number {
    let i = current;
    while (i < BANDS.length - 1 && kmh >= BANDS[i + 1].from + HYSTERESIS_KMH) i++;
    while (i > 0 && kmh < BANDS[i].from - HYSTERESIS_KMH) i--;
    return i;
}

export interface Padding {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface CameraMove {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    padding?: Padding;
    duration: number;
}

export interface CameraPort {
    move(to: CameraMove): void;
    /** Avisa cuando el usuario arrastra, hace zoom o gira el mapa con los dedos. */
    onGesture(fn: () => void): void;
}

/** `auto`: 3D a pie y plano a más velocidad. `3d` / `2d`: lo que fijó el usuario. */
export type TiltMode = 'auto' | '3d' | '2d';

export class FollowCamera extends Emitter<{ change: void }> {
    active = true;
    tilt: TiltMode = 'auto';
    headingUp = false;
    northLocked = false;
    band = 0;
    private last: Fix | null = null;

    constructor(
        private readonly camera: CameraPort,
        /** Píxeles que tapa la interfaz inferior: el usuario nunca queda debajo. */
        private readonly bottomInset: () => number = () => 0,
    ) {
        super();
        // Mover el mapa con el dedo abandona el seguimiento; solo se recupera con Recentrar.
        camera.onGesture(() => this.suspend());
    }

    get pitched() {
        return this.tilt === '3d' || (this.tilt === 'auto' && this.autoPitched);
    }

    get zoom() {
        return BANDS[this.band].zoom;
    }

    private get autoPitched() {
        return BANDS[this.band].name === 'walk';
    }

    update(fix: Fix) {
        this.last = fix;
        const kmh = fix.speed != null ? fix.speed * 3.6 : 0;
        const band = nextBand(this.band, kmh);
        const headingUp = !this.northLocked && (this.headingUp ? kmh >= HEADING_UP_OFF_KMH : kmh >= HEADING_UP_ON_KMH);
        const was = this.pitched;
        const changed = band !== this.band || headingUp !== this.headingUp;
        this.band = band;
        this.headingUp = headingUp;
        if (changed || was !== this.pitched) this.emit('change', undefined);
        if (this.active) this.follow(FOLLOW_MS);
    }

    /** Deja de seguir: por un gesto del usuario o al abrir una ficha. */
    suspend() {
        if (!this.active) return;
        this.active = false;
        this.emit('change', undefined);
    }

    recenter() {
        const was = this.active;
        this.active = true;
        if (!was) this.emit('change', undefined);
        this.follow(RECENTER_MS);
    }

    /** Cambió lo que tapa la interfaz inferior: reencuadra sin esperar a la próxima posición. */
    reframe() {
        if (this.active) this.follow(RECENTER_MS);
    }

    /**
     * El botón 2D/3D fija lo contrario de lo que se ve, a cualquier velocidad. Si lo que se pide es
     * justo lo que haría el modo automático a esta velocidad, vuelve al automático.
     */
    toggleTilt() {
        const want: TiltMode = this.pitched ? '2d' : '3d';
        this.tilt = (want === '3d') === this.autoPitched ? 'auto' : want;
        this.emit('change', undefined);
        if (this.active) this.follow(RECENTER_MS);
        else this.camera.move({ pitch: this.pitched ? PITCH_3D : 0, duration: RECENTER_MS });
    }

    /** La brújula fija el norte arriba a cualquier velocidad; otro toque lo desbloquea. */
    toggleNorth() {
        this.northLocked = !this.northLocked;
        if (this.northLocked) this.headingUp = false;
        this.emit('change', undefined);
        if (this.active) this.follow(RECENTER_MS);
        else if (this.northLocked) this.camera.move({ bearing: 0, duration: RECENTER_MS });
    }

    private follow(duration: number) {
        const fix = this.last;
        if (!fix) return;
        const inset = this.bottomInset();
        const headingUp = this.headingUp && fix.heading != null;
        this.camera.move({
            center: [fix.lon, fix.lat],
            zoom: this.zoom,
            bearing: headingUp ? fix.heading! : 0,
            pitch: this.pitched ? PITCH_3D : 0,
            // Rumbo arriba: el usuario baja al tercio inferior para ver lo que viene.
            padding: { top: headingUp ? Math.round(inset * 0.2 + 160) : 0, bottom: inset, left: 0, right: 0 },
            duration,
        });
    }
}
