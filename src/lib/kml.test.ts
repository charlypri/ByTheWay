import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { combineFiles, distanceM, langOfFile, mergeLanguages, parseKml, textFor } from './kml';

const kml = (placemarks: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`;

const placemark = (name: string, lon: number, lat: number, range?: number, description = '') => `
<Placemark><name>${name}</name><description>${description}</description>
${range === undefined ? '' : `<LookAt><range>${range}</range></LookAt>`}
<Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`;

describe('parseKml', () => {
    it('lee el Radio de acción de LookAt.range', () => {
        const [p] = parseKml(kml(placemark('Punto de test', -3.63, 40.53, 20000)));
        expect(p.radius).toBe(20000);
    });

    it('usa un radio por defecto cuando falta LookAt o su range no es válido', () => {
        const pois = parseKml(kml(placemark('Sin cámara', -3.68, 40.42) + placemark('Radio 0', -3.69, 40.42, 0)));
        expect(pois.map((p) => p.radius)).toEqual([30, 30]);
    });

    it('conserva la descripción como un único texto, párrafos incluidos', () => {
        const desc = 'Primero.\n\nSegundo.\n\nPor cierto, tercero.';
        const [p] = parseKml(kml(placemark('Miguel Moya', -3.68, 40.41, 20, desc)));
        expect(p.description).toBe(desc);
    });

    it('acepta POIs sin descripción', () => {
        const [p] = parseKml(kml(placemark('Vacío', -3.68, 40.41, 20)));
        expect(p.description).toBe('');
    });

    it('convierte en texto las descripciones con HTML de Google Earth', () => {
        const html = '<![CDATA[<p>Primero &amp; <b>mejor</b>.</p><p>Segundo.<br>Sigue.</p>]]>';
        const [p] = parseKml(kml(placemark('Con formato', -3.68, 40.41, 20, html)));
        expect(p.description).toBe('Primero & mejor.\n\nSegundo.\nSigue.');
    });

    it('ignora líneas, polígonos y puntos sin coordenadas válidas', () => {
        const pois = parseKml(
            kml(`
            <Placemark><name>Ruta</name><LineString><coordinates>-3.6,40.4,0 -3.7,40.5,0</coordinates></LineString></Placemark>
            <Placemark><name>Roto</name><Point><coordinates>abc</coordinates></Point></Placemark>
            ${placemark('Bueno', -3.68, 40.41, 20)}`),
        );
        expect(pois.map((p) => p.title)).toEqual(['Bueno']);
    });

    it('lee los POIs dentro de carpetas anidadas', () => {
        const pois = parseKml(kml(`<Folder><name>Retiro</name><Folder>${placemark('Dentro', -3.68, 40.41, 20)}</Folder></Folder>`));
        expect(pois).toHaveLength(1);
    });

    it('rechaza un fichero que no es XML', () => {
        expect(() => parseKml('<html><body>404</body>')).toThrow();
        expect(() => parseKml('Not found')).toThrow();
    });

    it('lee el dataset real completo', () => {
        const pois = parseKml(readFileSync('data/spain.es.kml', 'utf8'));
        expect(pois).toHaveLength(120);
        expect(pois.find((p) => p.title === 'Anguiano')?.radius).toBe(1500);
    });
});

describe('langOfFile', () => {
    it('saca el idioma del sufijo del nombre', () => {
        expect(langOfFile('spain.es.kml')).toBe('es');
        expect(langOfFile('retiro.EN.kml')).toBe('en');
        expect(langOfFile('spain.kml')).toBeUndefined();
        expect(langOfFile('spain.fr.kml')).toBeUndefined();
        expect(langOfFile('notas.es.txt')).toBeUndefined();
    });
});

describe('combineFiles', () => {
    it('suma los POIs de varios ficheros del mismo idioma', () => {
        const a = parseKml(kml(placemark('Uno', -3.68, 40.41, 20)));
        const b = parseKml(kml(placemark('Dos', -3.69, 40.42, 20)));
        expect(combineFiles([a, b]).map((p) => p.title)).toEqual(['Uno', 'Dos']);
    });

    it('con el mismo POI en dos ficheros, gana el primero', () => {
        const a = parseKml(kml(placemark('Original', -3.68, 40.41, 20)));
        const b = parseKml(kml(placemark('Copia', -3.680001, 40.41, 50)));
        expect(combineFiles([a, b])).toMatchObject([{ title: 'Original', radius: 20 }]);
    });
});

describe('mergeLanguages', () => {
    const es = parseKml(kml(placemark('Biblioteca Popular', -3.681, 40.421, 20) + placemark('Biblioteca Popular', -3.689, 40.415, 20)));

    it('empareja por coordenadas aunque los nombres se repitan', () => {
        const en = parseKml(kml(placemark('Public Library', -3.689, 40.415, 20)));
        const [first, second] = mergeLanguages({ es, en });
        expect(first.texts.en).toBeUndefined();
        expect(second.texts.en?.title).toBe('Public Library');
    });

    it('empareja hasta 1 m y no más allá', () => {
        const near = parseKml(kml(placemark('Near', -3.689008, 40.415, 20))); // ~0,7 m al este
        const far = parseKml(kml(placemark('Moved', -3.68903, 40.415, 20))); // ~2,5 m al este
        expect(distanceM(es[1], near[0])).toBeLessThanOrEqual(1);
        expect(distanceM(es[1], far[0])).toBeGreaterThan(1);
        expect(mergeLanguages({ es, en: near })[1].texts.en?.title).toBe('Near');
        expect(mergeLanguages({ es, en: far }).every((p) => !p.texts.en)).toBe(true);
    });

    it('el castellano define qué POIs existen y su radio', () => {
        const en = parseKml(kml(placemark('Public Library', -3.689, 40.415, 999) + placemark('English only', -3.7, 40.5, 20)));
        const pois = mergeLanguages({ es, en });
        expect(pois).toHaveLength(2);
        expect(pois[1].radius).toBe(20);
    });

    it('la identidad del POI son sus coordenadas redondeadas a 5 decimales', () => {
        expect(mergeLanguages({ es })[1].id).toBe('40.41500,-3.68900');
    });

    it('recurre al castellano cuando falta la traducción', () => {
        const [poi] = mergeLanguages({ es });
        expect(textFor(poi, 'en')).toMatchObject({ title: 'Biblioteca Popular', lang: 'es' });
    });
});
