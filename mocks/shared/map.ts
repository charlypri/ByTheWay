// Mapa TomTom para los mocks: POIs agrupados con estado, círculos de radio y posición del usuario.
import 'maplibre-gl/dist/maplibre-gl.css';
import { TomTomConfig } from '@tomtom-org/maps-sdk/core';
import { CustomGeoJSONModule, TomTomMap, type CustomGeoJSONModuleConfig, type StandardStyleID } from '@tomtom-org/maps-sdk/map';
import { circle } from '@turf/turf';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { setWorkerUrl, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
// MapLibre 6 carga su worker por URL relativa, que se pierde al empaquetar: se lo damos ya empaquetado.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Lang, Poi } from '../../src/lib/kml';
import { textFor } from '../../src/lib/kml';
import type { Fix, PoiState } from './guide';
import { SIM_START } from './position';

setWorkerUrl(workerUrl);
TomTomConfig.instance.put({ apiKey: import.meta.env.TOMTOM_API_KEY });

/** Radio a partir del cual el círculo se ve siempre, no solo al seleccionar el POI. */
const ALWAYS_SHOW_RADIUS_M = 200;

export interface MapTheme {
    /** Un icono por estado. Usa `drawIcon` para dibujarlos. */
    icons: Record<PoiState, ImageData>;
    puck: ImageData;
    /** `minZoom`: a partir de qué zoom se ven los nombres de los POIs (16,5 por defecto).
     *  `haloWidth` (1,5 por defecto) y `font` (Noto-Medium) son opcionales. */
    /** Si los iconos reservan espacio, los nombres los esquivan; exige lienzos sin margen sobrante. */
    iconsBlockLabels?: boolean;
    label: { color: string; halo: string; size?: number; minZoom?: number; offset?: number; offsetPlaying?: number; haloWidth?: number; font?: string };
    radius: { fill: string; line: string };
    cluster: { fill: string; text: string; stroke?: string };
    accuracy: string;
}

/** Dibuja un icono en un canvas a 2x y lo devuelve como ImageData para `config.images`. */
export function drawIcon(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): ImageData {
    const px = size * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    draw(ctx, size);
    return ctx.getImageData(0, 0, px, px);
}

type Sources = {
    radii: FeatureCollection<Polygon>;
    pois: FeatureCollection<Point>;
    accuracy: FeatureCollection<Polygon>;
    user: FeatureCollection<Point>;
};

export interface GuideMap {
    tt: TomTomMap;
    ml: MapLibreMap;
    render(pois: Poi[], stateOf: (p: Poi) => PoiState, lang: Lang, selected?: Poi | null): void;
    setUser(fix: Fix): void;
    /** Cambia el mapa base y los colores de las capas propias; los iconos no cambian. */
    setDark(dark: boolean, theme: MapTheme): void;
    setLanguage(lang: Lang): void;
    onPoiClick(fn: (poi: Poi) => void): void;
    onBackgroundClick(fn: () => void): void;
    flyToPoi(poi: Poi, bottomInset?: number): void;
}

function layersFor(theme: MapTheme): CustomGeoJSONModuleConfig<Sources>['sources'] {
    return {
        accuracy: { layers: [{ id: 'accuracy-fill', type: 'fill', paint: { 'fill-color': theme.accuracy } }] },
        radii: {
            layers: [
                // Solo el POI seleccionado lleva relleno: los radios grandes se solapan y oscurecerían el mapa.
                { id: 'radius-fill', type: 'fill', filter: ['==', ['get', 'selected'], true], paint: { 'fill-color': theme.radius.fill } },
                { id: 'radius-line', type: 'line', paint: { 'line-color': theme.radius.line, 'line-width': 1.5, 'line-dasharray': [2, 2] } },
            ],
        },
        pois: {
            cluster: { cluster: true, clusterRadius: 44, clusterMaxZoom: 13 },
            layers: [
                {
                    id: 'cluster-circle',
                    type: 'circle',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': theme.cluster.fill,
                        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
                        'circle-stroke-width': theme.cluster.stroke ? 2 : 0,
                        'circle-stroke-color': theme.cluster.stroke ?? 'rgba(0,0,0,0)',
                    },
                },
                {
                    id: 'cluster-count',
                    type: 'symbol',
                    filter: ['has', 'point_count'],
                    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto-Bold'], 'text-size': 13 },
                    paint: { 'text-color': theme.cluster.text },
                },
                // Nombres e iconos van en capas separadas y los iconos se dibujan encima: un nombre nunca tapa
                // un icono. Con `iconsBlockLabels` los iconos reservan su espacio y un nombre que choca con
                // cualquier icono se oculta; sin él, el nombre puede quedar por debajo de un icono vecino.
                {
                    id: 'poi-label',
                    type: 'symbol',
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'symbol-sort-key': ['match', ['get', 'state'], 'playing', 0, 'pending', 1, 'announced', 2, 3],
                        'text-field': ['step', ['zoom'], '', theme.label.minZoom ?? 16.5, ['get', 'title']],
                        'text-font': [theme.label.font ?? 'Noto-Medium'],
                        'text-size': theme.label.size ?? 12,
                        'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
                        'text-radial-offset': ['match', ['get', 'state'], 'playing', theme.label.offsetPlaying ?? theme.label.offset ?? 1.4, theme.label.offset ?? 1.4],
                        'text-justify': 'auto',
                        'text-max-width': 9,
                    },
                    paint: {
                        'text-color': theme.label.color,
                        'text-halo-color': theme.label.halo,
                        'text-halo-width': theme.label.haloWidth ?? 1.5,
                    },
                },
                {
                    id: 'poi-symbol',
                    type: 'symbol',
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'icon-image': ['concat', 'poi-', ['get', 'state']],
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': !theme.iconsBlockLabels,
                        'icon-padding': 0,
                        'symbol-sort-key': ['match', ['get', 'state'], 'playing', 0, 'pending', 1, 'announced', 2, 3],
                    },
                    paint: {
                        'icon-opacity': ['match', ['get', 'state'], 'heard', 0.7, 1],
                    },
                },
            ],
        },
        user: {
            layers: [
                {
                    id: 'user-puck',
                    type: 'symbol',
                    layout: {
                        'icon-image': 'puck',
                        'icon-rotate': ['get', 'heading'],
                        'icon-rotation-alignment': 'map',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                    },
                },
            ],
        },
    };
}

export interface MapStyles {
    light: StandardStyleID;
    dark: StandardStyleID;
}

const MONO: MapStyles = { light: 'monoLight', dark: 'monoDark' };

export async function createGuideMap(
    container: string,
    theme: MapTheme,
    opts: { dark?: boolean; lang?: Lang; styles?: MapStyles } = {},
): Promise<GuideMap> {
    const styles = opts.styles ?? MONO;
    const tt = new TomTomMap({
        style: opts.dark ? styles.dark : styles.light,
        language: opts.lang === 'en' ? 'en-GB' : 'es-ES',
        mapLibre: { container, center: SIM_START, zoom: 16 },
    });
    const ml = tt.mapLibreMap;

    const images = Object.fromEntries([
        ...Object.entries(theme.icons).map(([state, image]) => [`poi-${state}`, { image, options: { pixelRatio: 2 } }]),
        ['puck', { image: theme.puck, options: { pixelRatio: 2 } }],
    ]);

    const module = await CustomGeoJSONModule.create<Sources>(tt, { images, sources: layersFor(theme) });

    let current: Poi[] = [];
    const byId = () => new Map(current.map((p) => [p.id, p]));

    return {
        tt,
        ml,
        render(pois, stateOf, lang, selected) {
            current = pois;
            void module.show(
                {
                    type: 'FeatureCollection',
                    features: pois.map(
                        (p): Feature<Point> => ({
                            type: 'Feature',
                            id: p.id,
                            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
                            properties: { id: p.id, title: textFor(p, lang).title, state: stateOf(p) },
                        }),
                    ),
                },
                'pois',
            );
            const withCircle = pois.filter((p) => p.radius >= ALWAYS_SHOW_RADIUS_M || p.id === selected?.id);
            void module.show(
                {
                    type: 'FeatureCollection',
                    features: withCircle.map((p) => circle([p.lon, p.lat], p.radius, { units: 'meters', steps: 64, properties: { selected: p.id === selected?.id } })),
                },
                'radii',
            );
        },
        setUser(fix) {
            void module.show(
                {
                    type: 'FeatureCollection',
                    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] }, properties: { heading: fix.heading ?? 0 } }],
                },
                'user',
            );
            void module.show(
                { type: 'FeatureCollection', features: [circle([fix.lon, fix.lat], fix.accuracy, { units: 'meters', steps: 48 })] },
                'accuracy',
            );
        },
        setDark(dark, next) {
            tt.setStyle(dark ? styles.dark : styles.light);
            module.applyConfig({ images, sources: layersFor(next) });
        },
        setLanguage(lang) {
            tt.setLanguage(lang === 'en' ? 'en-GB' : 'es-ES');
        },
        onPoiClick(fn) {
            module.events.pois.on('click', (feature, _lngLat, features) => {
                const raw = feature ?? features?.[0];
                if (!raw) return;
                const props = raw.properties as Record<string, unknown> | null;
                if (props?.cluster) {
                    const source = ml.getSource(module.sourceAndLayerIDs.pois.sourceID) as GeoJSONSource;
                    void source.getClusterExpansionZoom(props.cluster_id as number).then((zoom) => {
                        ml.easeTo({ center: (raw.geometry as Point).coordinates as [number, number], zoom: zoom + 0.5 });
                    });
                    return;
                }
                const poi = byId().get(String(props?.id ?? raw.id));
                if (poi) fn(poi);
            });
        },
        onBackgroundClick(fn) {
            ml.on('click', (e) => {
                const hits = ml.queryRenderedFeatures(e.point, { layers: module.sourceAndLayerIDs.pois.layerIDs });
                if (!hits.length) fn();
            });
        },
        flyToPoi(poi, bottomInset = 0) {
            ml.easeTo({ center: [poi.lon, poi.lat], zoom: Math.max(ml.getZoom(), 17), padding: { bottom: bottomInset, top: 0, left: 0, right: 0 }, duration: 600 });
        },
    };
}
