import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { distanceM, mergeLanguages, parseKml, textFor } from './kml';

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

    it('usa un radio por defecto cuando falta LookAt', () => {
        const [p] = parseKml(kml(placemark('Sin cámara', -3.68, 40.42)));
        expect(p.radius).toBe(30);
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

    it('lee el dataset real completo', () => {
        const pois = parseKml(readFileSync('data/spain.es.kml', 'utf8'));
        expect(pois).toHaveLength(120);
        expect(pois.find((p) => p.title === 'Anguiano')?.radius).toBe(1500);
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

    it('no empareja puntos a más de 1 m', () => {
        const en = parseKml(kml(placemark('Moved', -3.68903, 40.415, 20))); // ~2.5 m al este
        expect(distanceM(es[1], en[0])).toBeGreaterThan(1);
        expect(mergeLanguages({ es, en }).every((p) => !p.texts.en)).toBe(true);
    });

    it('recurre al castellano cuando falta la traducción', () => {
        const [poi] = mergeLanguages({ es });
        expect(textFor(poi, 'en')).toMatchObject({ title: 'Biblioteca Popular', lang: 'es' });
    });
});
