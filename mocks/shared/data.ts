import { mergeLanguages, parseKml, type Lang, type Poi } from '../../src/lib/kml';

const DATASET = 'spain';

async function fetchKml(lang: Lang) {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${DATASET}.${lang}.kml`, { cache: 'no-cache' });
    if (!res.ok) return undefined;
    const text = await res.text();
    return text.trimStart().startsWith('<') ? parseKml(text) : undefined;
}

/** Descarga los KML de cada idioma y los empareja por coordenadas (ADR 0003 y 0004). */
export async function loadPois(): Promise<Poi[]> {
    const [es, en] = await Promise.all([fetchKml('es'), fetchKml('en').catch(() => undefined)]);
    if (!es) throw new Error('No se pudo cargar el conjunto de POIs');
    return mergeLanguages({ es, en });
}
