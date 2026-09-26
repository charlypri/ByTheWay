// Catálogo de POIs: descarga los KML de data/ en tiempo de ejecución (ADR 0004), los empareja
// por idioma (ADR 0003) y guarda la última versión buena para funcionar sin red.
import { combineFiles, langOfFile, mergeLanguages, parseKml, type KmlPlacemark, type Lang, type Poi } from './kml';
import type { KeyValueStore } from './storage';

export const REFRESH_MS = 30 * 60_000;
const CACHE_KEY = 'catalog';

export interface CatalogDeps {
    /** Descarga un fichero como texto; lanza un error si no llega. */
    fetchText(url: string): Promise<string>;
    store: KeyValueStore;
    /** URL de la carpeta data/, terminada en `/`. Ahí está `index.json` con la lista de ficheros. */
    dataUrl: string;
    now(): number;
    /** Repite `fn` cada `ms`; devuelve cómo pararlo. */
    every(fn: () => void, ms: number): () => void;
}

/** Sin red y sin una versión guardada: no hay POIs que mostrar. */
export class CatalogUnavailable extends Error {
    constructor() {
        super('No se pudieron descargar los lugares');
    }
}

interface Cache {
    /** Última versión buena de cada fichero de la lista. */
    files: Record<string, KmlPlacemark[]>;
}

interface Manifest {
    files: string[];
}

export class Catalog {
    pois: Poi[] = [];
    private signature = '';
    private pending: Poi[] | null = null;
    private busy = false;
    private lastCheck = -Infinity;
    private inFlight: Promise<boolean> | null = null;
    private stopTimer: (() => void) | null = null;
    private listeners: ((pois: Poi[]) => void)[] = [];

    constructor(private readonly deps: CatalogDeps) {}

    onChange(fn: (pois: Poi[]) => void) {
        this.listeners.push(fn);
    }

    /**
     * Arranca con la versión guardada, si la hay, y comprueba la de la red; sin versión guardada,
     * espera a la red. Lanza `CatalogUnavailable` si no hay forma de tener POIs.
     */
    async start(): Promise<void> {
        const cache = this.deps.store.get<Cache>(CACHE_KEY);
        this.stopTimer ??= this.deps.every(() => void this.refresh(), REFRESH_MS);
        if (cache?.files && Object.keys(cache.files).length) {
            this.offer(build(cache.files, Object.keys(cache.files)));
            void this.refresh();
            return;
        }
        const reached = await this.refresh();
        if (!reached && !this.pois.length) throw new CatalogUnavailable();
    }

    stop() {
        this.stopTimer?.();
        this.stopTimer = null;
    }

    /** Con una Narración en curso, una versión nueva espera a que termine. */
    setBusy(busy: boolean) {
        this.busy = busy;
        if (!busy && this.pending) {
            const next = this.pending;
            this.pending = null;
            this.apply(next);
        }
    }

    /** Al volver a la página: el navegador congela los temporizadores de las páginas ocultas. */
    async refreshIfStale(): Promise<void> {
        if (this.deps.now() - this.lastCheck >= REFRESH_MS) await this.refresh();
    }

    /** Descarga la lista y los ficheros. Devuelve si llegó al menos un fichero de la red. */
    refresh(): Promise<boolean> {
        this.inFlight ??= this.download().finally(() => (this.inFlight = null));
        return this.inFlight;
    }

    private async download(): Promise<boolean> {
        this.lastCheck = this.deps.now();
        const { dataUrl, fetchText, store } = this.deps;
        let manifest: Manifest;
        try {
            manifest = JSON.parse(await fetchText(`${dataUrl}index.json`)) as Manifest;
        } catch {
            return false; // sin red: sigue la versión que haya
        }
        const names = (Array.isArray(manifest.files) ? manifest.files : []).filter((f) => langOfFile(f)).sort();
        const previous = store.get<Cache>(CACHE_KEY)?.files ?? {};
        const files: Record<string, KmlPlacemark[]> = {};
        let reached = names.length === 0;
        await Promise.all(
            names.map(async (name) => {
                try {
                    files[name] = parseKml(await fetchText(`${dataUrl}${encodeURIComponent(name)}`));
                    reached = true;
                } catch {
                    // Un fichero roto o sin red no tumba a los demás: se usa su última versión buena.
                    if (previous[name]) files[name] = previous[name];
                }
            }),
        );
        if (!reached && !Object.keys(files).length) return false;
        store.set(CACHE_KEY, { files } satisfies Cache);
        this.offer(build(files, names));
        return reached;
    }

    private offer(pois: Poi[]) {
        if (this.busy && this.pois.length) this.pending = pois;
        else this.apply(pois);
    }

    private apply(pois: Poi[]) {
        const signature = JSON.stringify(pois);
        if (signature === this.signature) return;
        this.signature = signature;
        this.pois = pois;
        this.listeners.forEach((fn) => fn(pois));
    }
}

function build(files: Record<string, KmlPlacemark[]>, names: string[]): Poi[] {
    const byLang: Partial<Record<Lang, KmlPlacemark[][]>> = {};
    for (const name of [...names].sort()) {
        const lang = langOfFile(name);
        if (lang && files[name]) (byLang[lang] ??= []).push(files[name]);
    }
    return mergeLanguages({ es: combineFiles(byLang.es ?? []), en: combineFiles(byLang.en ?? []) });
}

/** `fetchText` del navegador: revalida siempre con el servidor para ver las versiones nuevas. */
export async function httpText(url: string): Promise<string> {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res.text();
}
