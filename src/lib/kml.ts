// Lectura de los KML que exporta el Editor desde Google Earth.
// Convenciones: el Radio de acción es <LookAt><range> (ADR 0001) y cada idioma
// es un fichero aparte cuyos POIs se emparejan por coordenadas (ADR 0003).

export type Lang = 'es' | 'en';

export const LANGS: readonly Lang[] = ['es', 'en'];

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

export interface KmlPlacemark extends PoiText {
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

/** `spain.es.kml` → `es`. Los ficheros sin idioma reconocible no se cargan. */
export function langOfFile(name: string): Lang | undefined {
    const m = /\.([a-z]{2})\.kml$/i.exec(name);
    const lang = m?.[1].toLowerCase();
    return LANGS.find((l) => l === lang);
}

/** Google Earth guarda en HTML las descripciones con formato; la app solo lee texto. */
function htmlToText(value: string): string {
    if (!/<[a-z!/]/i.test(value)) return value;
    const marked = value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n');
    const doc = new DOMParser().parseFromString(marked, 'text/html');
    return (doc.body.textContent ?? '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function parseKml(xml: string): KmlPlacemark[] {
    // Las secciones CDATA pasan a texto escapado: mismo resultado y no todos los parsers las aceptan.
    const plain = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, text: string) => escapeXml(text));
    const doc = new DOMParser().parseFromString(plain, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length || doc.documentElement?.localName !== 'kml') {
        throw new Error('El fichero no es un KML válido');
    }

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
            description: htmlToText(childText(pm, 'description')),
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
 * Suma los POIs de varios ficheros de un mismo idioma, en el orden dado. Dos POIs no pueden
 * compartir coordenadas (ADR 0003): si un POI se repite, gana el primer fichero.
 */
export function combineFiles(files: KmlPlacemark[][]): KmlPlacemark[] {
    const out: KmlPlacemark[] = [];
    for (const p of files.flat()) {
        if (!out.some((q) => distanceM(p, q) <= PAIRING_TOLERANCE_M)) out.push(p);
    }
    return out;
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
