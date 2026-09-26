import { beforeEach, describe, expect, it } from 'vitest';
import { Guide, RULES, type Fix } from './guide';
import type { Poi } from './kml';
import { memoryStore, type KeyValueStore } from './storage';

const HOUR = 60 * 60_000;
const M_PER_DEG_LAT = 111_195;

const poi = (id: string, lat: number, lon: number, radius: number): Poi => ({ id, lat, lon, radius, texts: { es: { title: id, description: '' } } });

// Un parque de 1 km y, en su borde norte, una estatua de 20 m; lejos, una fuente de 30 m.
const PARK = poi('parque', 40.415, -3.684, 1000);
const STATUE = poi('estatua', 40.415 + 990 / M_PER_DEG_LAT, -3.684, 20);
const FOUNTAIN = poi('fuente', 40.43, -3.684, 30);
const POIS = [PARK, STATUE, FOUNTAIN];

/** Posición a `north` metros al norte de un POI. */
const near = (p: Poi, north = 0, accuracy = 8): Omit<Fix, 't'> => ({ lat: p.lat + north / M_PER_DEG_LAT, lon: p.lon, accuracy, speed: 1.2, heading: 0 });
const FAR_AWAY: Omit<Fix, 't'> = { lat: 40.5, lon: -3.5, accuracy: 8, speed: 1.2, heading: 0 };

let store: KeyValueStore;
let now: number;
beforeEach(() => {
    store = memoryStore();
    now = Date.UTC(2026, 8, 26, 10);
});

/** Una guía con Anuncios que terminan cuando el test lo decide. */
function setup(pois: Poi[] = POIS) {
    const said: string[] = [];
    let finish: (() => void) | null = null;
    const guide = new Guide(pois, {
        store,
        now: () => now,
        announce: (p) =>
            new Promise<void>((resolve) => {
                said.push(p.id);
                finish = resolve;
            }),
    });
    const events: string[] = [];
    guide.on('announce', (p) => events.push(`announce:${p.id}`));
    guide.on('exit', (p) => events.push(`exit:${p.id}`));
    const at = (f: Omit<Fix, 't'>, times = 2) => {
        for (let i = 0; i < times; i++) guide.update({ ...f, t: now });
    };
    /** El título que está sonando termina. */
    const titleEnds = async () => {
        const f = finish;
        finish = null;
        f?.();
        await Promise.resolve();
        await Promise.resolve();
    };
    return { guide, said, events, at, titleEnds };
}

describe('Entrada', () => {
    it('se confirma con 2 posiciones seguidas dentro del radio', () => {
        const { guide, said, at } = setup();
        at(near(FOUNTAIN), 1);
        expect(said).toEqual([]);
        expect(guide.isInside(FOUNTAIN)).toBe(false);
        at(near(FOUNTAIN), 1);
        expect(said).toEqual(['fuente']);
    });

    it('una posición fuera entre medias reinicia la cuenta', () => {
        const { said, at } = setup();
        at(near(FOUNTAIN), 1);
        at(near(FOUNTAIN, 200), 1);
        at(near(FOUNTAIN), 1);
        expect(said).toEqual([]);
    });

    it('ignora las posiciones con precisión peor que 50 m', () => {
        const { said, at } = setup();
        at(near(FOUNTAIN, 0, RULES.maxAccuracyM + 1), 3);
        expect(said).toEqual([]);
        at(near(FOUNTAIN, 0, 50), 2);
        expect(said).toEqual(['fuente']);
    });

    it('usa un radio mínimo de 15 m sin tocar el del Editor', () => {
        const tiny = poi('placa', 40.44, -3.684, 3);
        const { guide, said, at } = setup([tiny]);
        at(near(tiny, 12));
        expect(said).toEqual(['placa']);
        expect(guide.pois[0].radius).toBe(3);
    });
});

describe('Anuncio', () => {
    it('dice solo el POI de la Entrada y lo marca como anunciado', () => {
        const { guide, said, events, at } = setup();
        at(near(FOUNTAIN));
        expect(said).toEqual(['fuente']);
        expect(events).toEqual(['announce:fuente']);
        expect(guide.stateOf(FOUNTAIN)).toBe('announced');
    });

    it('con varias Entradas a la vez, primero el radio mayor y luego el resto si sigues dentro', async () => {
        const { said, at, titleEnds } = setup();
        at(near(STATUE));
        expect(said).toEqual(['parque']);
        await titleEnds();
        expect(said).toEqual(['parque', 'estatua']);
    });

    it('descarta el Anuncio en cola si sales del radio antes de su turno, y se anuncia al volver', async () => {
        const { guide, said, at, titleEnds } = setup();
        at(near(STATUE));
        at(near(STATUE, -100)); // sigue en el parque, fuera de la estatua
        expect(guide.pending).toEqual([]);
        await titleEnds();
        expect(said).toEqual(['parque']);
        at(near(STATUE));
        expect(said).toEqual(['parque', 'estatua']);
    });

    it('avisa de la salida de un POI en el que se había entrado', () => {
        const { events, at } = setup();
        at(near(FOUNTAIN));
        at(near(FOUNTAIN, 200), 1);
        expect(events).toEqual(['announce:fuente', 'exit:fuente']);
    });
});

describe('Anuncio durante una Narración', () => {
    it('espera a que termine y se muestra en la cola', () => {
        const { guide, said, at } = setup();
        const queues: string[][] = [];
        guide.on('queue', (q) => queues.push(q.map((p) => p.id)));
        guide.startNarration(PARK);
        at(near(FOUNTAIN));
        expect(said).toEqual([]);
        expect(guide.pending.map((p) => p.id)).toEqual(['fuente']);
        expect(queues.at(-1)).toEqual(['fuente']);

        guide.endNarration();
        expect(said).toEqual(['fuente']);
        expect(guide.pending).toEqual([]);
    });

    it('si sales antes de que acabe, no se anuncia y podrá anunciarse al volver', () => {
        const { guide, said, at } = setup();
        guide.startNarration(PARK);
        at(near(FOUNTAIN));
        at(near(FOUNTAIN, 300));
        guide.endNarration();
        expect(said).toEqual([]);
        expect(guide.stateOf(FOUNTAIN)).toBe('pending');
        at(near(FOUNTAIN));
        expect(said).toEqual(['fuente']);
    });

    it('lanzar la Narración mientras suena un título deja la cola esperando', async () => {
        const { guide, said, at, titleEnds } = setup();
        at(near(STATUE)); // suena "parque", la estatua espera
        guide.startNarration(PARK);
        await titleEnds(); // el Narrador corta el título
        expect(said).toEqual(['parque']);
        guide.endNarration();
        expect(said).toEqual(['parque', 'estatua']);
    });

    it('empezar la Narración de un POI en cola lo saca de la cola', () => {
        const { guide, said, at } = setup();
        guide.startNarration(PARK);
        at(near(FOUNTAIN));
        guide.startNarration(FOUNTAIN);
        guide.endNarration();
        expect(said).toEqual([]);
        expect(guide.stateOf(FOUNTAIN)).toBe('heard');
    });
});

describe('Sesión', () => {
    it('salir y volver a entrar 2 h después no vuelve a anunciar; 13 h después, sí', async () => {
        const { said, at, titleEnds } = setup();
        at(near(FOUNTAIN));
        await titleEnds();
        at(FAR_AWAY);
        now += 2 * HOUR;
        at(near(FOUNTAIN));
        expect(said).toEqual(['fuente']);
        at(FAR_AWAY);
        now += 11 * HOUR;
        at(near(FOUNTAIN));
        expect(said).toEqual(['fuente', 'fuente']);
    });

    it('las 12 h cuentan desde el Anuncio y el POI vuelve a estar por escuchar', async () => {
        const { guide, at, titleEnds } = setup();
        at(near(FOUNTAIN));
        await titleEnds();
        now += RULES.sessionTtlMs - 1;
        expect(guide.stateOf(FOUNTAIN)).toBe('announced');
        now += 2;
        expect(guide.stateOf(FOUNTAIN)).toBe('pending');
    });

    it('seguir dentro cuando caducan las 12 h no provoca un Anuncio nuevo: hace falta una Entrada', async () => {
        const { said, at, titleEnds } = setup();
        at(near(FOUNTAIN));
        await titleEnds();
        now += 13 * HOUR;
        at(near(FOUNTAIN, 2));
        expect(said).toEqual(['fuente']);
    });

    it('sobrevive a una recarga de la página, igual que los Escuchados', async () => {
        const first = setup();
        first.at(near(FOUNTAIN));
        await first.titleEnds();
        first.guide.startNarration(PARK);
        first.guide.endNarration();

        const again = setup();
        expect(again.guide.stateOf(FOUNTAIN)).toBe('announced');
        expect(again.guide.stateOf(PARK)).toBe('heard');
        again.at(near(FOUNTAIN));
        expect(again.said).toEqual([]);
    });
});

describe('Escuchado', () => {
    it('se marca al empezar la Narración y ya no se anuncia nunca', () => {
        const { guide, said, at } = setup();
        guide.startNarration(FOUNTAIN);
        expect(guide.stateOf(FOUNTAIN)).toBe('playing');
        guide.endNarration();
        expect(guide.stateOf(FOUNTAIN)).toBe('heard');
        now += 48 * HOUR;
        at(near(FOUNTAIN));
        expect(said).toEqual([]);
    });

    it('una Narración escuchada en casa desde la ficha evita el Anuncio al pasar', () => {
        const { guide, said, at } = setup();
        at(FAR_AWAY);
        guide.startNarration(STATUE);
        guide.endNarration();
        at(near(STATUE));
        expect(said).toEqual(['parque']);
    });
});

describe('Empezar de cero', () => {
    it('tras un paseo completo, todos los POIs vuelven a estar por escuchar y se anuncian otra vez', async () => {
        const { guide, said, at, titleEnds } = setup();
        at(near(FOUNTAIN));
        await titleEnds();
        guide.startNarration(PARK);
        guide.endNarration();
        at(FAR_AWAY);

        guide.startOver();
        expect(POIS.map((p) => guide.stateOf(p))).toEqual(['pending', 'pending', 'pending']);
        at(near(FOUNTAIN));
        expect(said).toEqual(['fuente', 'fuente']);

        const reloaded = setup();
        expect(reloaded.guide.stateOf(PARK)).toBe('pending');
    });
});

describe('Radios anidados', () => {
    it('cada POI se evalúa por separado: dentro del parque, entrar en la estatua la anuncia', async () => {
        const { said, at, titleEnds } = setup();
        at(near(PARK));
        await titleEnds();
        at(near(STATUE));
        expect(said).toEqual(['parque', 'estatua']);
    });
});

describe('Versión nueva del catálogo', () => {
    it('conserva el estado de los POIs que siguen y olvida los que desaparecen', async () => {
        const { guide, said, at, titleEnds } = setup();
        at(near(STATUE));
        guide.setPois([PARK, FOUNTAIN]);
        expect(guide.pending).toEqual([]);
        await titleEnds();
        expect(guide.stateOf(PARK)).toBe('announced');
        expect(guide.isInside(PARK)).toBe(true);
        at(near(PARK, 5));
        expect(said).toEqual(['parque']);
    });
});

describe('Rendimiento', () => {
    it('procesa una posición con 1.000 POIs en menos de 4 ms', () => {
        const many = Array.from({ length: 1000 }, (_, i) => poi(`p${i}`, 40.4 + i * 0.001, -3.7, 30));
        const { guide } = setup(many);
        const start = performance.now();
        for (let i = 0; i < 100; i++) guide.update({ ...FAR_AWAY, t: now });
        expect((performance.now() - start) / 100).toBeLessThan(4);
    });
});
