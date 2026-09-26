// Lectura de los KML que exporta el Editor desde Google Earth.
// Convenciones: el Radio de acción es <LookAt><range> (ADR 0001) y cada idioma
// es un fichero aparte cuyos POIs se emparejan por coordenadas (ADR 0003).

export type Lang = 'es' | 'en';

export interface PoiText {
    title: string;
    description: string;
}

export interface Poi {
    /** Identidad del POI: sus coordenadas redondeadas (~1 m). */
    id: string;
    lon: number;
    lat: number;
    /** Radio de acción en metros, tal como lo fijó el Editor. */
    radius: number;
    texts: Partial<Record<Lang, PoiText>>;
}

interface KmlPlacemark extends PoiText {
    lon: number;
    lat: number;
    radius: number;
}

const KML_NS = 'http://www.opengis.net/kml/2.2';
const DEFAULT_RADIUS_M = 30;
const PAIRING_TOLERANCE_M = 1;

export const poiId = (lon: number, lat: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

const childText = (el: Element, name: string) =>
    el.getElementsByTagNameNS(KML_NS, name)[0]?.textContent?.trim() ?? '';

export function parseKml(xml: string): KmlPlacemark[] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('El fichero no es un KML válido');

    const placemarks: KmlPlacemark[] = [];
    for (const pm of Array.from(doc.getElementsByTagNameNS(KML_NS, 'Placemark'))) {
        const point = pm.getElementsByTagNameNS(KML_NS, 'Point')[0];
        if (!point) continue; // solo POIs puntuales; líneas y polígonos no son POIs
        const [lon, lat] = childText(point, 'coordinates').split(',').map(Number);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        const lookAt = pm.getElementsByTagNameNS(KML_NS, 'LookAt')[0];
        const range = lookAt ? Number(childText(lookAt, 'range')) : NaN;
        placemarks.push({
            lon,
            lat,
            radius: range > 0 ? range : DEFAULT_RADIUS_M,
            title: childText(pm, 'name'),
            description: childText(pm, 'description'),
        });
    }
    return placemarks;
}

export function distanceM(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

/**
 * Une los POIs de cada idioma en un único conjunto. El castellano es el idioma base:
 * define qué POIs existen y su radio; los de otro idioma solo aportan su texto.
 */
export function mergeLanguages(byLang: Partial<Record<Lang, KmlPlacemark[]>>): Poi[] {
    const pois: Poi[] = (byLang.es ?? []).map((p) => ({
        id: poiId(p.lon, p.lat),
        lon: p.lon,
        lat: p.lat,
        radius: p.radius,
        texts: { es: { title: p.title, description: p.description } },
    }));
    for (const p of byLang.en ?? []) {
        const match = pois.find((poi) => !poi.texts.en && distanceM(poi, p) <= PAIRING_TOLERANCE_M);
        if (match) match.texts.en = { title: p.title, description: p.description };
    }
    return pois;
}

/** Texto del POI en el idioma pedido o, si no existe, en castellano. */
export function textFor(poi: Poi, lang: Lang): PoiText & { lang: Lang } {
    const own = poi.texts[lang];
    if (own) return { ...own, lang };
    return { ...(poi.texts.es ?? { title: '', description: '' }), lang: 'es' };
}
