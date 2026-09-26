import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Catalog, CatalogUnavailable, type CatalogDeps } from './catalog';
import { memoryStore, type KeyValueStore } from './storage';

const kml = (...placemarks: [string, number, number][]) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks
    .map(([name, lon, lat]) => `<Placemark><name>${name}</name><LookAt><range>40</range></LookAt><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`)
    .join('')}</Document></kml>`;

/** Servidor falso: ficheros de data/ por nombre; `null` simula un fallo de red. */
function server(files: Record<string, string | null>) {
    const state = { files, requests: [] as string[] };
    const fetchText = vi.fn(async (url: string) => {
        state.requests.push(url);
        const name = url.replace('/data/', '');
        if (name === 'index.json') {
            const listed = Object.keys(state.files);
            if (state.files['index.json'] === null) throw new Error('sin red');
            return JSON.stringify({ files: listed.filter((f) => f !== 'index.json') });
        }
        const body = state.files[name];
        if (body == null) throw new Error(`HTTP 404 ${name}`);
        return body;
    });
    return { state, fetchText };
}

function clock() {
    let now = 0;
    let task: { fn: () => void; every: number; next: number } | null = null;
    return {
        now: () => now,
        every: (fn: () => void, ms: number) => {
            task = { fn, every: ms, next: now + ms };
            return () => (task = null);
        },
        /** Pasa el tiempo sin que corran los temporizadores. */
        jump(ms: number) {
            now += ms;
            if (task) task.next = now + task.every;
        },
        async advance(ms: number) {
            now += ms;
            while (task && task.next <= now) {
                task.next += task.every;
                task.fn();
                await flush();
            }
        },
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let store: KeyValueStore;
beforeEach(() => {
    store = memoryStore();
});

function catalog(fetchText: CatalogDeps['fetchText'], c = clock()) {
    return new Catalog({ fetchText, store, dataUrl: '/data/', now: c.now, every: c.every });
}

describe('Catalog', () => {
    it('descarga la lista de ficheros y empareja los idiomas', async () => {
        const { fetchText } = server({
            'spain.es.kml': kml(['Estanque', -3.684, 40.418]),
            'spain.en.kml': kml(['Pond', -3.684, 40.418]),
        });
        const cat = catalog(fetchText);
        await cat.start();
        expect(cat.pois).toHaveLength(1);
        expect(cat.pois[0].texts.en?.title).toBe('Pond');
    });

    it('suma varios ficheros del mismo idioma e ignora los que no siguen el nombre', async () => {
        const { fetchText, state } = server({
            'retiro.es.kml': kml(['Estanque', -3.684, 40.418]),
            'rioja.es.kml': kml(['Anguiano', -2.765, 42.264]),
            'borrador.kml': kml(['Sin idioma', -3, 40]),
            'LEEME.md': '# notas',
        });
        const cat = catalog(fetchText);
        await cat.start();
        expect(cat.pois.map((p) => p.texts.es?.title).sort()).toEqual(['Anguiano', 'Estanque']);
        expect(state.requests).not.toContain('/data/LEEME.md');
    });

    it('si un fichero falla, carga los demás', async () => {
        const { fetchText } = server({ 'retiro.es.kml': kml(['Estanque', -3.684, 40.418]), 'rioja.es.kml': null, 'spain.en.kml': 'no es xml' });
        const cat = catalog(fetchText);
        await cat.start();
        expect(cat.pois.map((p) => p.texts.es?.title)).toEqual(['Estanque']);
    });

    it('un fichero que falla conserva su última versión buena', async () => {
        const srv = server({ 'retiro.es.kml': kml(['Estanque', -3.684, 40.418]), 'rioja.es.kml': kml(['Anguiano', -2.765, 42.264]) });
        const c = clock();
        const cat = catalog(srv.fetchText, c);
        await cat.start();
        srv.state.files['rioja.es.kml'] = null;
        await c.advance(30 * 60_000);
        expect(cat.pois).toHaveLength(2);
    });

    it('sin red arranca con la última versión guardada', async () => {
        const online = server({ 'spain.es.kml': kml(['Estanque', -3.684, 40.418]) });
        await catalog(online.fetchText).start();

        const offline = server({ 'index.json': null });
        const cat = catalog(offline.fetchText);
        await cat.start();
        expect(cat.pois.map((p) => p.texts.es?.title)).toEqual(['Estanque']);
    });

    it('sin red y sin nada guardado no puede arrancar', async () => {
        const { fetchText } = server({ 'index.json': null });
        await expect(catalog(fetchText).start()).rejects.toBeInstanceOf(CatalogUnavailable);
    });

    it('comprueba si hay versión nueva cada 30 minutos y avisa solo si cambia', async () => {
        const srv = server({ 'spain.es.kml': kml(['Estanque', -3.684, 40.418]) });
        const c = clock();
        const cat = catalog(srv.fetchText, c);
        const changes = vi.fn();
        cat.onChange(changes);
        await cat.start();
        expect(changes).toHaveBeenCalledTimes(1);

        await c.advance(30 * 60_000);
        expect(changes).toHaveBeenCalledTimes(1);

        srv.state.files['nuevo.es.kml'] = kml(['Palacio de Cristal', -3.682, 40.413]);
        await c.advance(29 * 60_000);
        expect(cat.pois).toHaveLength(1);
        await c.advance(60_000);
        expect(cat.pois).toHaveLength(2);
        expect(changes).toHaveBeenCalledTimes(2);
    });

    it('guarda una versión nueva para después si hay una Narración en curso', async () => {
        const srv = server({ 'spain.es.kml': kml(['Estanque', -3.684, 40.418]) });
        const c = clock();
        const cat = catalog(srv.fetchText, c);
        await cat.start();

        cat.setBusy(true);
        srv.state.files['spain.es.kml'] = kml(['Estanque', -3.684, 40.418], ['Palacio de Cristal', -3.682, 40.413]);
        await c.advance(30 * 60_000);
        expect(cat.pois).toHaveLength(1);

        cat.setBusy(false);
        expect(cat.pois).toHaveLength(2);
    });

    it('al volver a la página comprueba si el temporizador se quedó atrás', async () => {
        const srv = server({ 'spain.es.kml': kml(['Estanque', -3.684, 40.418]) });
        const c = clock();
        const cat = catalog(srv.fetchText, c);
        await cat.start();
        const before = srv.state.requests.length;

        await cat.refreshIfStale();
        expect(srv.state.requests.length).toBe(before);

        // Con la página oculta el navegador congela los temporizadores.
        c.jump(45 * 60_000);
        await cat.refreshIfStale();
        expect(srv.state.requests.length).toBeGreaterThan(before);
    });

    it('conserva la identidad de los POIs entre versiones', async () => {
        const srv = server({ 'spain.es.kml': kml(['Estanque', -3.684, 40.418]) });
        const c = clock();
        const cat = catalog(srv.fetchText, c);
        await cat.start();
        const id = cat.pois[0].id;
        srv.state.files['spain.es.kml'] = kml(['Estanque grande', -3.684, 40.418]);
        await c.advance(30 * 60_000);
        expect(cat.pois[0]).toMatchObject({ id, texts: { es: { title: 'Estanque grande' } } });
    });
});
