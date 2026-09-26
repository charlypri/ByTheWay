// Mapa TomTom (sección 5): POIs agrupados con su estado, radios, usuario, edificios en 3D y tema
// claro/oscuro. También es la cámara del Modo seguimiento (`CameraPort`).
import 'maplibre-gl/dist/maplibre-gl.css';
import { TomTomConfig } from '@tomtom-org/maps-sdk/core';
import { BaseMapModule, CustomGeoJSONModule, TomTomMap, type CustomGeoJSONModuleConfig } from '@tomtom-org/maps-sdk/map';
import { circle } from '@turf/turf';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
// MapLibre 6 carga su worker por URL relativa, que se pierde al empaquetar: se lo damos ya empaquetado.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { CameraPort } from '../lib/follow';
import type { Fix, PoiState } from '../lib/guide';
import { LOCALE } from '../lib/i18n';
import { textFor, type Lang, type Poi } from '../lib/kml';
import { COLORS, poiIcons, puckIcon } from './icons';

setWorkerUrl(workerUrl);
TomTomConfig.instance.put({ apiKey: import.meta.env.TOMTOM_API_KEY });

/** Radio a partir del cual el contorno del círculo se ve siempre, no solo al seleccionar el POI. */
const ALWAYS_SHOW_RADIUS_M = 200;
/** Por debajo de este zoom los POIs se agrupan (La Rioja frente a Madrid). */
const CLUSTER_MAX_ZOOM = 13;
const STYLES = { light: 'standardLight', dark: 'standardDark' } as const;
/** El Retiro, mientras no hay posición. */
export const DEFAULT_CENTER: [number, number] = [-3.6843, 40.4153];

type Sources = {
    radii: FeatureCollection<Polygon>;
    pois: FeatureCollection<Point>;
    accuracy: FeatureCollection<Polygon>;
    user: FeatureCollection<Point>;
};

function layers(dark: boolean): CustomGeoJSONModuleConfig<Sources>['sources'] {
    const label = dark ? { color: '#F1F3F5', halo: 'rgba(12,14,16,0.92)' } : { color: '#15181B', halo: 'rgba(255,255,255,0.96)' };
    const radius = dark ? { fill: 'rgba(255,255,255,0.05)', line: 'rgba(241,243,245,0.8)' } : { fill: 'rgba(21,24,27,0.05)', line: 'rgba(21,24,27,0.75)' };
    const cluster = dark ? { fill: '#F1F3F5', text: '#15181B', stroke: '#15181B' } : { fill: '#15181B', text: '#FFFFFF', stroke: '#FFFFFF' };
    const accuracy = dark ? 'rgba(90,155,255,0.22)' : 'rgba(31,111,235,0.14)';
    const sortKey: ExpressionSpecification = ['match', ['get', 'state'], 'playing', 0, 'pending', 1, 'announced', 2, 3];
    return {
        accuracy: {
            layers: [
                {
                    id: 'accuracy-fill',
                    type: 'fill',
                    paint: { 'fill-color': ['case', ['get', 'weak'], 'rgba(138,145,153,0.22)', accuracy] },
                },
            ],
        },
        radii: {
            layers: [
                // Solo el POI seleccionado lleva relleno: los radios grandes se solapan y oscurecerían el mapa.
                { id: 'radius-fill', type: 'fill', filter: ['==', ['get', 'selected'], true], paint: { 'fill-color': radius.fill } },
                { id: 'radius-line', type: 'line', paint: { 'line-color': radius.line, 'line-width': 1.5, 'line-dasharray': [2, 2] } },
            ],
        },
        pois: {
            cluster: { cluster: true, clusterRadius: 64, clusterMaxZoom: CLUSTER_MAX_ZOOM },
            layers: [
                {
                    id: 'cluster-circle',
                    type: 'circle',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': cluster.fill,
                        'circle-radius': ['step', ['get', 'point_count'], 28, 10, 34, 50, 42],
                        'circle-stroke-width': 3,
                        'circle-stroke-color': cluster.stroke,
                    },
                },
                {
                    id: 'cluster-count',
                    type: 'symbol',
                    filter: ['has', 'point_count'],
                    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto-Bold'], 'text-size': 22 },
                    paint: { 'text-color': cluster.text },
                },
                // Nombres e iconos van en capas separadas y los iconos encima: un nombre nunca tapa un icono.
                // Los iconos reservan su espacio y un nombre que choca con cualquier icono se oculta.
                {
                    id: 'poi-label',
                    type: 'symbol',
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'symbol-sort-key': sortKey,
                        'text-field': ['step', ['zoom'], '', 16, ['get', 'title']],
                        'text-font': ['Noto-Bold'],
                        'text-size': 26,
                        'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
                        'text-radial-offset': ['match', ['get', 'state'], 'playing', 1.6, 1.2],
                        'text-justify': 'auto',
                        'text-max-width': 9,
                    },
                    paint: { 'text-color': label.color, 'text-halo-color': label.halo, 'text-halo-width': 3 },
                },
                {
                    id: 'poi-symbol',
                    type: 'symbol',
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'icon-image': ['concat', 'poi-', ['get', 'state']],
                        'icon-allow-overlap': true,
                        'icon-padding': 0,
                        'symbol-sort-key': sortKey,
                    },
                    paint: { 'icon-opacity': ['match', ['get', 'state'], 'heard', 0.7, 1] },
                },
            ],
        },
        user: {
            layers: [
                {
                    id: 'user-puck',
                    type: 'symbol',
                    layout: {
                        'icon-image': ['case', ['get', 'weak'], 'puck-weak', 'puck'],
                        'icon-rotate': ['get', 'heading'],
                        'icon-rotation-alignment': 'map',
                        'icon-pitch-alignment': 'map',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                    },
                },
            ],
        },
    };
}

export interface GuideMap {
    ml: MapLibreMap;
    camera: CameraPort;
    /** Se llama solo cuando cambia un estado, la selección o el idioma; nunca por cada posición. */
    renderPois(pois: Poi[], stateOf: (p: Poi) => PoiState, lang: Lang, selectedId: string | null): void;
    /** `weak`: el GPS no tiene precisión suficiente para las Entradas. */
    setUser(fix: Fix, weak: boolean): void;
    setDark(dark: boolean): void;
    setLanguage(lang: Lang): void;
    onPoiClick(fn: (poi: Poi) => void): void;
    onBackgroundClick(fn: () => void): void;
    flyTo(poi: { lon: number; lat: number }, bottomInset: number): void;
}

export async function createGuideMap(container: HTMLElement, opts: { dark: boolean; lang: Lang }): Promise<GuideMap> {
    let dark = opts.dark;
    const tt = new TomTomMap({
        style: dark ? STYLES.dark : STYLES.light,
        language: LOCALE[opts.lang],
        mapLibre: { container, center: DEFAULT_CENTER, zoom: 15 },
    });
    const ml = tt.mapLibreMap;

    const images = Object.fromEntries([
        ...Object.entries(poiIcons()).map(([state, image]) => [`poi-${state}`, { image, options: { pixelRatio: 2 } }]),
        ['puck', { image: puckIcon(COLORS.blue), options: { pixelRatio: 2 } }],
        ['puck-weak', { image: puckIcon(COLORS.grey), options: { pixelRatio: 2 } }],
    ]);
    const module = await CustomGeoJSONModule.create<Sources>(tt, { images, sources: layers(dark) });
    // Edificios en 3D: el estilo estándar los trae ocultos. La configuración se reaplica sola al cambiar de estilo.
    BaseMapModule.get(tt, { layerGroupsVisibility: { mode: 'include', names: ['buildings3D'], visible: true } }).catch(() => {
        // Sin el módulo, el mapa sigue funcionando con los edificios planos.
    });

    let byId = new Map<string, Poi>();
    const easing = (t: number) => t * (2 - t);

    return {
        ml,
        camera: {
            move: (m) => ml.easeTo({ ...m, easing }),
            onGesture(fn) {
                const leave = (e: { originalEvent?: unknown }) => {
                    if (e.originalEvent) fn();
                };
                for (const ev of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const) ml.on(ev, leave);
            },
        },
        renderPois(pois, stateOf, lang, selectedId) {
            byId = new Map(pois.map((p) => [p.id, p]));
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
            const circles = pois.filter((p) => p.radius >= ALWAYS_SHOW_RADIUS_M || p.id === selectedId);
            void module.show(
                {
                    type: 'FeatureCollection',
                    features: circles.map((p) => circle([p.lon, p.lat], p.radius, { units: 'meters', steps: 64, properties: { selected: p.id === selectedId } })),
                },
                'radii',
            );
        },
        setUser(fix, weak) {
            void module.show(
                {
                    type: 'FeatureCollection',
                    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] }, properties: { heading: fix.heading ?? 0, weak } }],
                },
                'user',
            );
            void module.show(
                { type: 'FeatureCollection', features: [circle([fix.lon, fix.lat], Math.max(fix.accuracy, 1), { units: 'meters', steps: 48, properties: { weak } })] },
                'accuracy',
            );
        },
        setDark(next) {
            if (next === dark) return;
            dark = next;
            tt.setStyle(dark ? STYLES.dark : STYLES.light);
            module.applyConfig({ images, sources: layers(dark) });
        },
        setLanguage(lang) {
            tt.setLanguage(LOCALE[lang]);
        },
        onPoiClick(fn) {
            module.events.pois.on('click', (feature, _lngLat, features) => {
                const raw = feature ?? features?.[0];
                if (!raw) return;
                const props = raw.properties as Record<string, unknown> | null;
                if (props?.cluster) {
                    // Tocar un grupo acerca el zoom hasta separarlo.
                    const source = ml.getSource(module.sourceAndLayerIDs.pois.sourceID) as GeoJSONSource;
                    void source.getClusterExpansionZoom(props.cluster_id as number).then((zoom) => {
                        ml.easeTo({ center: (raw.geometry as Point).coordinates as [number, number], zoom: zoom + 0.5 });
                    });
                    return;
                }
                const poi = byId.get(String(props?.id ?? raw.id));
                if (poi) fn(poi);
            });
        },
        onBackgroundClick(fn) {
            ml.on('click', (e) => {
                const hits = ml.queryRenderedFeatures(e.point, { layers: module.sourceAndLayerIDs.pois.layerIDs });
                if (!hits.length) fn();
            });
        },
        flyTo(p, bottomInset) {
            ml.easeTo({ center: [p.lon, p.lat], zoom: Math.max(ml.getZoom(), 17), padding: { bottom: bottomInset, top: 0, left: 0, right: 0 }, duration: 600, easing });
        },
    };
}
