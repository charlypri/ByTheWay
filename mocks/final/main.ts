// Mock final: la base de C "Mínima" (mapa claro que manda, botones pequeños, burbuja, ficha,
// inicio y modo bolsillo) con los paneles grafito de B "Navegador" (Anuncio, Narración y
// "A continuación"), sus ajustes, su marcador de usuario y sus iconos de estado.
// En reposo, sin Anuncio ni Narración, abajo no hay nada: solo el mapa.
import './style.css';
import { BaseMapModule } from '@tomtom-org/maps-sdk/map';
import type { Lang, Poi } from '../../src/lib/kml';
import { MockApp, type MockUI } from '../shared/boot';
import { prefersDark } from '../shared/daylight';
import { BANDS } from '../shared/follow';
import type { PoiState } from '../shared/guide';
import { drawIcon, type MapTheme } from '../shared/map';
import { SIM_START, type SpeedProfile } from '../shared/position';
import { splitSentences, type NarrationProgress } from '../shared/speech';
import { formatDistance, paragraphs, t, type StringKey } from '../shared/ui';

// ---------------------------------------------------------------------------
// Textos propios (los comunes están en shared/ui.ts)

const ES = {
    mapLabel: 'Mapa',
    guide: 'Guía',
    tagline: 'Un guía que te avisa al pasar junto a cada lugar y te lo cuenta si quieres.',
    legendNew: 'Por descubrir',
    legendAnnounced: 'Anunciado',
    loading: 'Cargando lugares…',
    leftBehind: 'Lo has dejado atrás',
    closesIn: 'Se cierra en {n} s',
    read: 'Leer',
    listenAgain: 'Volver a escuchar',
    narrating: 'Narrando',
    paused: 'En pausa',
    sentence: 'Frase {i} de {n}',
    more: 'y {n} más',
    distance: 'a {d} de ti',
    dismiss: 'Descartar',
    playingNow: 'Sonando ahora',
    announced: 'Anunciado hoy',
    openPlace: 'Abrir {t}',
    view3d: 'Vista 3D',
    view3dOn: 'Vista 3D activada',
    view3dOff: 'Vista 3D desactivada',
    voice: 'Voz',
    voiceHint: 'La que dice los Anuncios y lee las Narraciones.',
    voiceBest: '{v} · recomendada',
    noVoices: 'Este navegador no puede leer en voz alta.',
    voiceSample: 'Así sonará tu guía.',
    pocketHint: 'Pantalla negra para llevar el móvil en el bolsillo. La guía sigue avisando.',
    pocketOn: 'Activar modo bolsillo',
    startOver: 'Empezar de cero',
    startOverHint: 'Todos los lugares vuelven a anunciarse, también los que ya escuchaste.',
    startOverAsk: '¿Empezar de cero?',
    startOverConfirm: 'Se volverán a anunciar todos los lugares, también los que ya escuchaste.',
    startOverDone: 'Hecho: todos los lugares se volverán a anunciar',
    cancel: 'Cancelar',
    guideOn: 'La guía sigue contigo',
    gpsOn: 'Usando tu GPS',
    simOn: 'Paseo simulado',
    walkEnded: 'Fin del paseo simulado',
    demo: 'Demo',
    demoTitle: 'Herramientas de demo',
    demoNote: 'Solo para probar el prototipo; no forman parte de la app.',
    restartWalk: 'Reiniciar',
    profile: 'Cómo te mueves',
    clock: 'Reloj de la simulación',
    forceTheme: 'Tema',
    themeAuto: 'Auto',
    themeDay: 'Día',
    themeNight: 'Noche',
    readout: '{src}. Zoom {z}, {orient}, {tilt}. {follow}',
    headingUp: 'rumbo arriba',
    northUp: 'norte arriba',
    flat: 'plano',
    tilted: 'en 3D',
    following: 'La cámara te sigue.',
    notFollowing: 'Cámara libre.',
};
const EN: Record<keyof typeof ES, string> = {
    mapLabel: 'Map',
    guide: 'Guide',
    tagline: 'A guide that tells you when you pass each place, and its story if you ask.',
    legendNew: 'New',
    legendAnnounced: 'Announced',
    loading: 'Loading places…',
    leftBehind: "You've passed it",
    closesIn: 'Closes in {n} s',
    read: 'Read',
    listenAgain: 'Listen again',
    narrating: 'Narrating',
    paused: 'Paused',
    sentence: 'Sentence {i} of {n}',
    more: 'and {n} more',
    distance: '{d} away',
    dismiss: 'Dismiss',
    playingNow: 'Playing now',
    announced: 'Announced today',
    openPlace: 'Open {t}',
    view3d: '3D view',
    view3dOn: '3D view on',
    view3dOff: '3D view off',
    voice: 'Voice',
    voiceHint: 'The one that says the announcements and reads the stories.',
    voiceBest: '{v} · recommended',
    noVoices: "This browser can't read aloud.",
    voiceSample: 'This is how your guide will sound.',
    pocketHint: 'Black screen for carrying your phone in a pocket. The guide keeps announcing.',
    pocketOn: 'Turn on pocket mode',
    startOver: 'Start over',
    startOverHint: "Every place will be announced again, including the ones you've heard.",
    startOverAsk: 'Start over?',
    startOverConfirm: "Every place will be announced again, including the ones you've already heard.",
    startOverDone: 'Done: every place will be announced again',
    cancel: 'Cancel',
    guideOn: 'The guide is still with you',
    gpsOn: 'Using your GPS',
    simOn: 'Simulated walk',
    walkEnded: 'Simulated walk finished',
    demo: 'Demo',
    demoTitle: 'Demo tools',
    demoNote: 'Only for trying out the prototype; not part of the app.',
    restartWalk: 'Restart',
    profile: 'How you move',
    clock: 'Simulation clock',
    forceTheme: 'Theme',
    themeAuto: 'Auto',
    themeDay: 'Day',
    themeNight: 'Night',
    readout: '{src}. Zoom {z}, {orient}, {tilt}. {follow}',
    headingUp: 'heading up',
    northUp: 'north up',
    flat: 'flat',
    tilted: 'in 3D',
    following: 'The camera follows you.',
    notFollowing: 'The camera is free.',
};
const LOCAL: Record<Lang, typeof EN> = { es: ES, en: EN };
type Key = StringKey | keyof typeof ES;

function s(key: Key, vars?: Record<string, string | number>): string {
    const lang = app.lang;
    const raw = key in ES ? LOCAL[lang][key as keyof typeof ES] : t(lang, key as StringKey);
    return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw;
}

// ---------------------------------------------------------------------------
// Paleta de B: grafito, rojo para lo que suena, ámbar para lo anunciado, gris para lo escuchado
// y azul para el usuario. Los iconos son los de B a 1,4×, iguales en claro, oscuro y 3D.

const COLORS = { ink: '#15181B', red: '#DF1B12', amber: '#FFB100', grey: '#8A9199', blue: '#1F6FEB' };
const ICON_SCALE = 1.4;

/** Disco con aro blanco y sombra (geometría de B), centrado en el origen. */
function disc(x: CanvasRenderingContext2D, r: number, fill: string) {
    const c = 0;
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.45)';
    x.shadowBlur = 4;
    x.shadowOffsetY = 1.5;
    x.beginPath();
    x.arc(c, c, r + 2.5, 0, Math.PI * 2);
    x.fillStyle = '#FFFFFF';
    x.fill();
    x.restore();
    x.beginPath();
    x.arc(c, c, r, 0, Math.PI * 2);
    x.fillStyle = fill;
    x.fill();
}

/**
 * Cada icono ocupa solo su disco más la sombra: el lienzo es la caja de colisión con la que los
 * nombres esquivan los iconos, así que no debe llevar margen sobrante.
 */
const icon = (r: number, draw: (x: CanvasRenderingContext2D, c: number) => void) => {
    const units = (r + 2.5 + 2) * 2;
    return drawIcon(Math.round(units * ICON_SCALE), (x, size) => {
        x.scale(size / units, size / units);
        x.translate(units / 2, units / 2);
        draw(x, 0);
    });
};

const ICONS: Record<PoiState, ImageData> = {
    // Por descubrir: disco grafito con aro blanco, el de más contraste.
    pending: icon(6.5, (x, c) => {
        disc(x, 6.5, COLORS.ink);
        x.beginPath();
        x.arc(c, c, 2.2, 0, Math.PI * 2);
        x.fillStyle = '#FFFFFF';
        x.fill();
    }),
    // Anunciado: ámbar, sigue invitando.
    announced: icon(7, (x, c) => {
        disc(x, 7, COLORS.amber);
        x.beginPath();
        x.arc(c, c, 2.2, 0, Math.PI * 2);
        x.fillStyle = COLORS.ink;
        x.fill();
    }),
    // Escuchado: gris pequeño con ✓, se retira.
    heard: icon(5.5, (x, c) => {
        disc(x, 5.5, COLORS.grey);
        x.beginPath();
        x.moveTo(c - 2.6, c + 0.1);
        x.lineTo(c - 0.7, c + 2);
        x.lineTo(c + 2.7, c - 1.9);
        x.strokeStyle = '#FFFFFF';
        x.lineWidth = 1.9;
        x.lineCap = 'round';
        x.lineJoin = 'round';
        x.stroke();
    }),
    // Sonando: rojo con barras de sonido, el único marcador grande.
    playing: icon(10.5, (x, c) => {
        disc(x, 10.5, COLORS.red);
        x.fillStyle = '#FFFFFF';
        [
            [-4.6, 2.8],
            [-1.15, 5.6],
            [2.3, 3.8],
        ].forEach(([dx, h]) => x.fillRect(c + dx, c - h, 2.4, h * 2));
    }),
};

// Usuario: la flecha azul de B (el core la gira con el rumbo).
const PUCK = drawIcon(44, (x) => {
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.45)';
    x.shadowBlur = 5;
    x.shadowOffsetY = 1.5;
    x.beginPath();
    x.moveTo(22, 6);
    x.lineTo(34, 36);
    x.lineTo(22, 29.5);
    x.lineTo(10, 36);
    x.closePath();
    x.fillStyle = COLORS.blue;
    x.fill();
    x.restore();
    x.lineWidth = 3;
    x.strokeStyle = '#FFFFFF';
    x.lineJoin = 'round';
    x.stroke();
});

function theme(dark: boolean): MapTheme {
    // Nombres grandes con halo fuerte: se leen sobre el mapa de color, en oscuro y en 3D.
    const label = { size: 14.5, minZoom: 16, offset: 1.2, offsetPlaying: 1.6, haloWidth: 2.2, font: 'Noto-Bold' };
    return {
        icons: ICONS,
        iconsBlockLabels: true,
        puck: PUCK,
        label: dark ? { ...label, color: '#F1F3F5', halo: 'rgba(12,14,16,0.92)' } : { ...label, color: '#15181B', halo: 'rgba(255,255,255,0.96)' },
        radius: dark ? { fill: 'rgba(255,255,255,0.05)', line: 'rgba(241,243,245,0.8)' } : { fill: 'rgba(21,24,27,0.05)', line: 'rgba(21,24,27,0.75)' },
        cluster: dark ? { fill: '#F1F3F5', text: '#15181B', stroke: '#15181B' } : { fill: '#15181B', text: '#FFFFFF', stroke: '#FFFFFF' },
        accuracy: dark ? 'rgba(90,155,255,0.22)' : 'rgba(31,111,235,0.14)',
    };
}

/** El mismo icono en la interfaz (leyenda, ficha, "A continuación"). */
function glyphSvg(state: PoiState) {
    const k = 'viewBox="0 0 24 24" aria-hidden="true"';
    switch (state) {
        case 'pending':
            return `<svg ${k}><circle cx="12" cy="12" r="10" fill="#fff"/><circle cx="12" cy="12" r="7.2" fill="${COLORS.ink}"/><circle cx="12" cy="12" r="2.5" fill="#fff"/></svg>`;
        case 'announced':
            return `<svg ${k}><circle cx="12" cy="12" r="10.5" fill="#fff"/><circle cx="12" cy="12" r="7.8" fill="${COLORS.amber}"/><circle cx="12" cy="12" r="2.5" fill="${COLORS.ink}"/></svg>`;
        case 'heard':
            return `<svg ${k}><circle cx="12" cy="12" r="9" fill="#fff"/><circle cx="12" cy="12" r="6.6" fill="${COLORS.grey}"/><path d="M9 12.1l2.2 2.2 4-4.3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'playing':
            return `<svg ${k}><circle cx="12" cy="12" r="11" fill="#fff"/><circle cx="12" cy="12" r="8.8" fill="${COLORS.red}"/><rect x="7.6" y="9.6" width="2" height="4.8" fill="#fff"/><rect x="11" y="7.2" width="2" height="9.6" fill="#fff"/><rect x="14.4" y="8.8" width="2" height="6.4" fill="#fff"/></svg>`;
    }
}

// ---------------------------------------------------------------------------
// Iconos de la interfaz

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const I = {
    play: svg('<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>'),
    pause: svg('<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
    stop: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>'),
    text: svg('<path d="M5 6h14M5 10.5h14M5 15h14M5 19.5h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
};
const iconLabel = (i: string, label: string) => `${i}<span>${esc(label)}</span>`;

// ---------------------------------------------------------------------------
// DOM

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const html = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

const el = {
    bubble: $<HTMLButtonElement>('bubble'),
    dock: $('dock'),
    stack: $('stack'),
    recenter: $<HTMLButtonElement>('recenter'),
    upnext: $<HTMLButtonElement>('upnext'),
    panel: $('panel'),
    pCard: $('p-card'),
    pPlayer: $('p-player'),
    sheet: $('sheet'),
    sheetBody: $('sheet-body'),
    settings: $('settings'),
    confirm: $('confirm'),
    demo: $('demo'),
    scrim: $('scrim'),
    start: $('start'),
    pocket: $('pocket'),
    voice: $<HTMLSelectElement>('voice-select'),
};

// ---------------------------------------------------------------------------
// Estado de la interfaz

const LINGER_MS = 30_000;
const DARK_CHECK_MS = 60_000;

/** Tarjeta del Anuncio: vive mientras estás dentro del radio y 30 s después de salir. */
let card: { poi: Poi; exitAt: number | null } | null = null;
let cardTimer: ReturnType<typeof setTimeout> | undefined;
let narr: { poi: Poi; p: NarrationProgress } | null = null;
let queue: Poi[] = [];
let sheetPoi: Poi | null = null;
let sheetKey = '';
/** Al abrir la ficha: ¿seguía la cámara al usuario? ¿movió el mapa mientras tanto? */
let sheetFollow = { was: false, panned: false };
let returnFocus: HTMLElement | null = null;
let pocketOn = false;
let audio: AudioContext | null = null;
/** Solo para la demo: fuerza día o noche para revisar ambos temas a cualquier hora. */
let forcedTheme: 'auto' | 'day' | 'night' = 'auto';
let lastDarkCheck = 0;

// ---------------------------------------------------------------------------
// MockUI

const ui: MockUI = {
    name: 'final',
    defaultLang: 'es',
    theme,
    mapStyles: { light: 'standardLight', dark: 'standardDark' },
    initialDark: () => prefersDark(null),
    // En reposo no hay panel: el usuario se centra en todo el mapa.
    bottomInset: () => {
        if (panelMode() === 'none') return 0;
        const top = el.stack.getBoundingClientRect().top;
        return Math.max(0, Math.round(window.innerHeight - top + 16));
    },
    onReady(a) {
        a.follow.tilt = 'auto';
        a.narrator.preferred = loadVoices();
        a.narrator.onVoices = renderVoices;
        const ml = a.map.ml;
        ml.on('move', placeBubble);
        ml.on('rotate', renderCompass);
        // Mover el mapa con el dedo con la ficha abierta: al cerrarla no se recentra.
        const touched = (e: { originalEvent?: unknown }) => {
            if (e.originalEvent && sheetPoi) sheetFollow.panned = true;
        };
        ml.on('dragstart', touched);
        ml.on('zoomstart', touched);
        ml.on('rotatestart', touched);
        void enableBuildings();
        // Antes de empezar, el punto de partida se ve en la mitad libre, sobre la pantalla de inicio.
        if (!a.started) ml.jumpTo({ center: SIM_START, padding: { top: 0, left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.5) } });
        $<HTMLButtonElement>('start-btn').disabled = false;
        applyStrings();
        renderAll();
    },
    onAnnounce(poi) {
        clearTimeout(cardTimer);
        card = { poi, exitAt: app.guide.isInside(poi) ? null : Date.now() };
        if (card.exitAt != null) armLinger(poi);
        $('card-live').textContent = `${s('nearYou')}: ${app.text(poi).title}`;
        renderPanel();
        renderPocket();
    },
    onExit(poi) {
        if (card?.poi.id === poi.id && card.exitAt == null) {
            card.exitAt = Date.now();
            armLinger(poi);
            renderPanel();
            renderPocket();
        }
    },
    onQueue(q) {
        // Una Entrada nueva espera a que termine la Narración: aviso visual y campanilla.
        if (q.length > queue.length && app.narrating) chime();
        queue = q;
        renderUpNext();
        renderPocket();
    },
    onSelect(poi) {
        // Tocar otro POI o el fondo del mapa cierra la ficha abierta.
        if (sheetPoi && poi?.id !== sheetPoi.id) closeSheet(false);
        renderBubble();
    },
    onStates() {
        if (!app.guide) return;
        renderBubble();
        if (sheetPoi) renderSheet();
        renderPanel();
    },
    onFix(fix) {
        // Si vuelves a entrar en el radio del Anuncio, la tarjeta deja de cerrarse.
        if (card?.exitAt != null && app.guide.isInside(card.poi)) {
            card.exitAt = null;
            clearTimeout(cardTimer);
            renderPanel();
        }
        if (fix.t - lastDarkCheck >= DARK_CHECK_MS) {
            lastDarkCheck = fix.t;
            evaluateDark();
        }
        renderDistances();
        renderBubble();
        if (sheetPoi) renderSheetMeta();
        renderPocket();
        if (!el.demo.hidden) renderDemo();
    },
    onFollowChange() {
        renderFollow();
        if (!el.demo.hidden) renderDemo();
    },
    onNarration(poi, progress) {
        narr = poi && progress ? { poi, p: progress } : null;
        // La Narración consume la tarjeta del Anuncio de ese POI.
        if (poi && card?.poi.id === poi.id) {
            clearTimeout(cardTimer);
            card = null;
        }
        renderPanel();
        if (sheetPoi) renderSheet();
        renderPocket();
    },
    onError(message) {
        if (!app.started) {
            const e = $('start-error');
            e.hidden = false;
            e.textContent = message;
        }
        toast(message);
    },
    onSimEnd() {
        toast(s('walkEnded'));
        renderDemo();
    },
};

const app = new MockApp(ui);
(window as unknown as { app: MockApp }).app = app;

applyTheme();
applyStrings();
renderGlyphs();
syncInert();
void app.boot('map');

// ---------------------------------------------------------------------------
// Tema automático: oscuro si el sistema lo pide o si es de noche donde estás

function evaluateDark() {
    if (!app.map) return;
    const dark = forcedTheme === 'auto' ? prefersDark(app.fix) : forcedTheme === 'night';
    if (dark === app.dark) return;
    app.setDark(dark);
    applyTheme();
}

function applyTheme() {
    html.dataset.theme = app.dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', app.dark ? '#111315' : '#eef0f1');
    renderThemeForce();
}

function renderThemeForce() {
    document.querySelectorAll<HTMLButtonElement>('[data-theme-force]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeForce === forcedTheme)));
}

darkQuery.addEventListener('change', evaluateDark);

/** Edificios en 3D: el estilo estándar los trae ocultos; se encienden con el grupo del SDK. */
async function enableBuildings() {
    try {
        // La configuración se reaplica sola cuando el tema cambia de estilo (claro ↔ oscuro).
        await BaseMapModule.get(app.map.tt, { layerGroupsVisibility: { mode: 'include', names: ['buildings3D'], visible: true } });
    } catch {
        // Sin el módulo, el mapa sigue funcionando con los edificios planos.
    }
}

// ---------------------------------------------------------------------------
// Render

function renderAll() {
    if (!app.guide) return;
    renderPanel();
    renderBubble();
    if (sheetPoi) renderSheet();
    renderFollow();
    renderPocket();
    renderDemo();
}

/** Siempre con la cifra: dentro del radio, "Estás aquí · 10 m". */
function distanceText(poi: Poi) {
    const d = app.distanceTo(poi);
    if (d == null) return '';
    const txt = formatDistance(d, app.lang);
    return app.guide.isInside(poi) ? `${t(app.lang, 'nearYou')} · ${txt}` : s('distance', { d: txt });
}

/** Distancia en vivo para las tarjetas: la cifra grande y la unidad pequeña, como en B. */
function distanceHtml(m: number | null) {
    const txt = formatDistance(m, app.lang);
    const i = txt.lastIndexOf(' ');
    if (!txt) return '';
    return i < 0 ? `<b>${esc(txt)}</b>` : `<b>${esc(txt.slice(0, i))}</b><small>${esc(txt.slice(i + 1))}</small>`;
}

function panelMode(): 'player' | 'card' | 'none' {
    return narr ? 'player' : card ? 'card' : 'none';
}

function renderPanel() {
    if (!app.guide) return;
    const mode = panelMode();
    if (el.panel.dataset.mode !== mode) {
        const wasNone = el.panel.dataset.mode === 'none';
        el.panel.dataset.mode = mode;
        el.panel.hidden = mode === 'none';
        el.pCard.hidden = mode !== 'card';
        el.pPlayer.hidden = mode !== 'player';
        // Aparece o desaparece el panel: la cámara reencuadra ya, sin esperar a la próxima posición.
        if ((wasNone || mode === 'none') && app.started && app.follow?.active) requestAnimationFrame(() => app.follow.recenter());
    }
    if (mode === 'card') renderCard();
    if (mode === 'player') renderPlayer();
    renderUpNext();
    syncLingerTick();
}

function renderCard() {
    if (!card) return;
    const tx = app.text(card.poi);
    const title = $('card-title');
    title.textContent = tx.title;
    title.lang = tx.lang;
    $('card-badge').hidden = tx.lang === app.lang;
    const inside = card.exitAt == null;
    $('card-status').classList.toggle('is-left', !inside);
    $('card-status-text').textContent = inside ? s('nearYou') : s('leftBehind');
    $('card-listen').innerHTML = iconLabel(I.play, app.guide.stateOf(card.poi) === 'heard' ? s('listenAgain') : s('listen'));
    $('card-read').innerHTML = iconLabel(I.text, s('read'));
    $('card-linger').hidden = inside;
    renderLinger();
    renderDistances();
}

function renderLinger() {
    if (!card || card.exitAt == null) return;
    const left = Math.max(0, LINGER_MS - (Date.now() - card.exitAt));
    $('linger-text').textContent = s('closesIn', { n: Math.ceil(left / 1000) });
    $('linger-bar').style.width = `${(left / LINGER_MS) * 100}%`;
}

function renderPlayer() {
    if (!narr) return;
    const tx = app.text(narr.poi);
    const paused = app.narrator.paused;
    const title = $('pl-title-text');
    title.textContent = tx.title;
    title.lang = tx.lang;
    $('pl-title').setAttribute('aria-label', s('openPlace', { t: tx.title }));
    $('pl-state').classList.toggle('is-paused', paused);
    $('pl-state-text').textContent = paused ? s('paused') : s('narrating');
    const total = Math.max(1, narr.p.total);
    const i = Math.min(narr.p.index + 1, total);
    $('pl-count').textContent = s('sentence', { i, n: total });
    $('pl-bar').style.width = `${(i / total) * 100}%`;
    const toggle = $('pl-toggle');
    toggle.innerHTML = paused ? iconLabel(I.play, s('resume')) : iconLabel(I.pause, s('pause'));
    toggle.classList.toggle('is-paused', paused);
    $('pl-stop').innerHTML = iconLabel(I.stop, s('stop'));
    renderDistances();
}

/** La distancia en vivo de la tarjeta y del reproductor. */
function renderDistances() {
    if (card && !narr) $('card-dist').innerHTML = distanceHtml(app.distanceTo(card.poi));
    if (narr) $('pl-dist').innerHTML = distanceHtml(app.distanceTo(narr.poi));
}

/** "A continuación" va pegado al panel; sin tarjeta ni reproductor no se muestra. */
function renderUpNext() {
    const first = panelMode() === 'none' ? undefined : queue[0];
    el.upnext.hidden = !first;
    if (!first) return;
    const tx = app.text(first);
    $('upnext-title').textContent = tx.title;
    $('upnext-title').lang = tx.lang;
    $('upnext-more').textContent = queue.length > 1 ? s('more', { n: queue.length - 1 }) : '';
    el.upnext.setAttribute('aria-label', `${s('next')}: ${tx.title}`);
}

function stateText(state: PoiState) {
    return state === 'playing' ? s('playingNow') : state === 'heard' ? t(app.lang, 'heard') : state === 'announced' ? s('announced') : '';
}

function renderBubble() {
    const poi = app.selected;
    const show = !!poi && !sheetPoi && !pocketOn && app.started;
    el.bubble.hidden = !show;
    if (!show || !poi) return;
    const tx = app.text(poi);
    const title = $('bubble-title');
    title.textContent = tx.title;
    title.lang = tx.lang;
    const state = app.guide.stateOf(poi);
    $('bubble-meta').textContent = [distanceText(poi), stateText(state)].filter(Boolean).join(' · ');
    el.bubble.dataset.state = state;
    el.bubble.setAttribute('aria-label', `${s('openPlace', { t: tx.title })}. ${$('bubble-meta').textContent}`);
    placeBubble();
}

function placeBubble() {
    const poi = app.selected;
    if (!poi || el.bubble.hidden) return;
    const p = app.map.ml.project([poi.lon, poi.lat]);
    // Se mantiene dentro de la pantalla; el pico sigue apuntando al POI.
    const w = el.bubble.offsetWidth;
    const h = el.bubble.offsetHeight;
    const margin = 12;
    const left = Math.min(Math.max(p.x - w / 2, margin), window.innerWidth - w - margin);
    const tip = Math.min(Math.max(p.x - left, 20), w - 20);
    const lift = app.guide.stateOf(poi) === 'playing' ? 30 : 24;
    const offscreen = p.x < 0 || p.x > window.innerWidth || p.y < 0 || p.y > window.innerHeight;
    el.bubble.style.visibility = offscreen ? 'hidden' : '';
    el.bubble.style.setProperty('--tip', `${Math.round(tip)}px`);
    el.bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(p.y - h - lift)}px)`;
}

function renderSheet() {
    const poi = sheetPoi;
    if (!poi) return;
    const tx = app.text(poi);
    const title = $('sheet-title');
    title.textContent = tx.title;
    title.lang = tx.lang;

    const key = `${poi.id}|${app.lang}`;
    if (key !== sheetKey) {
        sheetKey = key;
        const body = el.sheetBody;
        const paras = paragraphs(tx.description);
        body.innerHTML = paras.length ? paras.map((p) => `<p>${esc(p)}</p>`).join('') : `<p class="empty">${esc(t(app.lang, 'noDescription'))}</p>`;
        body.lang = paras.length ? tx.lang : app.lang;
        body.scrollTop = 0;
    }
    renderSheetMeta();

    const playing = narr?.poi.id === poi.id;
    const state = app.guide.stateOf(poi);
    $('sheet-listen').hidden = playing;
    $('sheet-playing').hidden = !playing;
    $('sheet-listen-label').textContent = state === 'heard' ? s('listenAgain') : t(app.lang, 'listen');
    if (playing) {
        const paused = app.narrator.paused;
        $('sheet-toggle').innerHTML = paused ? iconLabel(I.play, t(app.lang, 'resume')) : iconLabel(I.pause, t(app.lang, 'pause'));
    }
    markCurrentParagraph();
}

/** Marca el párrafo que se está leyendo; la frase 0 es el título. */
function markCurrentParagraph() {
    const ps = Array.from(el.sheetBody.querySelectorAll('p'));
    ps.forEach((p) => p.classList.remove('current'));
    if (!sheetPoi || narr?.poi.id !== sheetPoi.id) return;
    let at = 1;
    const idx = narr.p.index;
    for (const p of ps) {
        const n = splitSentences(p.textContent ?? '').length || 1;
        if (idx >= at && idx < at + n) {
            p.classList.add('current');
            break;
        }
        at += n;
    }
}

function renderSheetMeta() {
    if (!sheetPoi) return;
    const state = app.guide.stateOf(sheetPoi);
    const st = stateText(state);
    const tx = app.text(sheetPoi);
    $('sheet-meta').innerHTML = [
        `<span class="meta-dist">${esc(distanceText(sheetPoi))}</span>`,
        st ? `<span class="state">${glyphSvg(state)}${esc(st)}</span>` : '',
        tx.lang !== app.lang ? `<span class="badge">${esc(t(app.lang, 'onlyInSpanish'))}</span>` : '',
    ]
        .filter(Boolean)
        .join('');
}

function renderFollow() {
    if (!app.follow) return;
    const f = app.follow;
    el.recenter.hidden = f.active || !app.started || !!sheetPoi;
    const north = $('north-btn');
    north.setAttribute('aria-pressed', String(f.northLocked));
    // "Norte arriba" con aria-pressed: pulsado fija el norte; suelto, el mapa gira con el rumbo.
    north.setAttribute('aria-label', t(app.lang, 'north'));
    north.title = t(app.lang, 'north');
    const tilt = $('tilt-btn');
    tilt.setAttribute('aria-pressed', String(f.pitched));
    tilt.setAttribute('aria-label', s('view3d'));
    tilt.title = f.pitched ? s('view3dOn') : s('view3dOff');
    renderCompass();
}

function renderCompass() {
    const b = app.map?.ml.getBearing() ?? 0;
    $('needle').setAttribute('transform', `rotate(${-b} 12 12)`);
}

function renderPocket() {
    if (!pocketOn) return;
    const st = $('pocket-status');
    const line = (dot: string, poi: Poi) => {
        const d = app.distanceTo(poi);
        return `<span class="pocket-dot ${dot}"></span><span>${esc(app.text(poi).title)}${d != null ? ` <span class="pocket-dist">· ${esc(formatDistance(d, app.lang))}</span>` : ''}</span>`;
    };
    if (narr) st.innerHTML = line('playing', narr.poi);
    else if (card) st.innerHTML = line('announced', card.poi);
    else st.textContent = s('guideOn');
}

function renderDemo() {
    if (!app.guide) return;
    const simRunning = app.source === 'sim' && app.sim.running;
    $('sim-toggle').innerHTML = iconLabel(simRunning ? I.pause : I.play, simRunning ? t(app.lang, 'simPause') : t(app.lang, 'simulate'));
    document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.profile === app.sim.profile)));
    document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === app.sim.timeScale)));
    $('gps-btn').setAttribute('aria-pressed', String(app.source === 'gps'));
    renderThemeForce();
    const f = app.follow;
    // Sin velocidad en pantalla, ni siquiera aquí: basta con ver cómo responde la cámara.
    $('demo-readout').textContent = f
        ? s('readout', {
              src: app.source === 'gps' ? s('gpsOn') : s('simOn'),
              z: BANDS[f.band].zoom.toLocaleString(app.lang === 'es' ? 'es-ES' : 'en-GB'),
              orient: f.headingUp ? s('headingUp') : s('northUp'),
              tilt: f.pitched ? s('tilted') : s('flat'),
              follow: f.active ? s('following') : s('notFollowing'),
          })
        : '';
}

function renderGlyphs() {
    document.querySelectorAll<HTMLElement>('.glyph[data-state]').forEach((g) => (g.innerHTML = glyphSvg(g.dataset.state as PoiState)));
    document.querySelector('.upnext-dot')!.innerHTML = glyphSvg('announced');
}

// ---------------------------------------------------------------------------
// Voz

const voiceKey = (lang: Lang) => `btw-final:voice:${lang}`;

function loadVoices(): Partial<Record<Lang, string>> {
    const out: Partial<Record<Lang, string>> = {};
    for (const lang of ['es', 'en'] as const) {
        try {
            const v = localStorage.getItem(voiceKey(lang));
            if (v) out[lang] = v;
        } catch {
            /* sin almacenamiento */
        }
    }
    return out;
}

/** "Microsoft Helena - Spanish (Spain)" → "Microsoft Helena · España". */
function voiceName(v: SpeechSynthesisVoice) {
    const base = v.name.replace(/\s+[-–]\s+[^-–]*$/, '').trim() || v.name;
    const region = v.lang.replace('_', '-').split('-')[1];
    let place = '';
    try {
        if (region) place = new Intl.DisplayNames([app.lang], { type: 'region' }).of(region.toUpperCase()) ?? '';
    } catch {
        place = region;
    }
    return place && !base.includes(place) ? `${base} · ${place}` : base;
}

function renderVoices() {
    const sel = el.voice;
    if (!app.narrator) return;
    const voices = app.narrator.voicesFor(app.lang);
    if (!voices.length) {
        sel.innerHTML = `<option>${esc(s('noVoices'))}</option>`;
        sel.disabled = true;
        return;
    }
    sel.disabled = false;
    const current = app.narrator.voiceFor(app.lang);
    sel.innerHTML = voices
        .map((v, i) => {
            const name = voiceName(v);
            return `<option value="${esc(v.voiceURI)}">${esc(i === 0 ? s('voiceBest', { v: name }) : name)}</option>`;
        })
        .join('');
    sel.value = current?.voiceURI ?? voices[0].voiceURI;
}

el.voice.addEventListener('change', () => {
    const uri = el.voice.value;
    const best = app.narrator.voicesFor(app.lang)[0];
    // Elegir la recomendada es volver al automático.
    if (best && uri === best.voiceURI) delete app.narrator.preferred[app.lang];
    else app.narrator.preferred[app.lang] = uri;
    try {
        if (app.narrator.preferred[app.lang]) localStorage.setItem(voiceKey(app.lang), uri);
        else localStorage.removeItem(voiceKey(app.lang));
    } catch {
        /* sin almacenamiento */
    }
    if (!app.narrating) void app.narrator.say(s('voiceSample'), app.lang);
});

// ---------------------------------------------------------------------------
// Acciones

function armLinger(poi: Poi) {
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => {
        if (card?.poi.id === poi.id && !app.guide.isInside(poi)) dismissCard(false);
    }, LINGER_MS);
    syncLingerTick();
}

/** Cuenta atrás de la tarjeta: el reloj solo corre si hay una tarjeta que se va a cerrar y se ve. */
let lingerTick: ReturnType<typeof setInterval> | undefined;
function syncLingerTick() {
    const need = !pocketOn && card?.exitAt != null;
    if (need && !lingerTick) lingerTick = setInterval(renderLinger, 1000);
    if (!need && lingerTick) {
        clearInterval(lingerTick);
        lingerTick = undefined;
    }
}

function dismissCard(focusPanel = true) {
    clearTimeout(cardTimer);
    const hadFocus = el.panel.contains(document.activeElement);
    card = null;
    renderPanel();
    renderPocket();
    if (focusPanel || hadFocus) focusPanelPrimary();
}

function listen(poi: Poi) {
    if (narr?.poi.id === poi.id) return togglePause();
    app.narrate(poi);
}

function togglePause() {
    if (app.narrator.paused) app.resume();
    else app.pause();
}

function openSheet(poi: Poi) {
    const opening = !sheetPoi;
    if (opening) {
        returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
        sheetFollow = { was: app.follow.active, panned: false };
    }
    sheetPoi = poi;
    sheetKey = '';
    if (app.selected?.id !== poi.id) app.select(poi);
    app.follow.suspend();
    document.body.classList.add('sheet-open');
    el.sheet.hidden = false;
    el.sheet.style.transform = '';
    renderSheet();
    renderBubble();
    renderFollow();
    syncInert();
    requestAnimationFrame(() => {
        // Se centra el POI en el hueco que deja la ficha.
        app.map.flyToPoi(poi, el.sheet.offsetHeight + 28);
        $('sheet-title').focus({ preventScroll: true });
    });
}

/** `deselect`: false cuando la ficha se cierra porque ya cambió la selección. */
function closeSheet(deselect = true) {
    if (!sheetPoi) return;
    sheetPoi = null;
    sheetKey = '';
    el.sheet.hidden = true;
    document.body.classList.remove('sheet-open');
    if (deselect) app.select(null);
    syncInert();
    // Vuelve a seguirte solo si te seguía al abrirla y no has movido el mapa.
    if (sheetFollow.was && !sheetFollow.panned) app.follow.recenter();
    renderFollow();
    renderBubble();
    renderPanel();
    const back = returnFocus;
    returnFocus = null;
    if (back && document.contains(back) && !back.closest('[hidden]') && !back.closest('[inert]')) back.focus({ preventScroll: true });
    else focusPanelPrimary();
}

/** El control principal del panel o, sin panel, el primer botón del mapa. */
function focusPanelPrimary() {
    const mode = panelMode();
    const target = mode === 'player' ? $('pl-toggle') : mode === 'card' ? $('card-listen') : $('settings-btn');
    target.focus({ preventScroll: true });
}

let settingsReturn: HTMLElement | null = null;
function openSettings() {
    closeDemo();
    settingsReturn = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    renderVoices();
    el.settings.hidden = false;
    el.scrim.hidden = false;
    syncInert();
    $('settings-close').focus({ preventScroll: true });
}

function closeSettings(restore = true) {
    if (el.settings.hidden) return;
    closeConfirm(false);
    el.settings.hidden = true;
    el.scrim.hidden = true;
    syncInert();
    if (restore) (settingsReturn ?? $('settings-btn')).focus({ preventScroll: true });
    settingsReturn = null;
}

function openConfirm() {
    el.confirm.hidden = false;
    syncInert();
    $('confirm-cancel').focus({ preventScroll: true });
}

function closeConfirm(restore = true) {
    if (el.confirm.hidden) return;
    el.confirm.hidden = true;
    syncInert();
    if (restore) $('start-over').focus({ preventScroll: true });
}

function startOver() {
    app.guide.resetAll();
    closeConfirm(false);
    closeSettings();
    toast(s('startOverDone'));
    renderAll();
}

function toggleDemo(open = el.demo.hidden) {
    el.demo.hidden = !open;
    $('demo-btn').setAttribute('aria-expanded', String(open));
    if (open) {
        renderDemo();
        el.demo.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    }
}
const closeDemo = () => toggleDemo(false);

/** Con un diálogo modal abierto, el resto no recibe foco ni lectores de pantalla. */
function syncInert() {
    const modal = pocketOn || !el.settings.hidden;
    const pre = !el.start.hidden;
    for (const id of ['map', 'top-left', 'top-right', 'bubble', 'demo']) $(id).inert = modal || pre;
    el.dock.inert = modal || pre || !!sheetPoi;
    el.sheet.inert = modal;
    el.settings.inert = pocketOn || !el.confirm.hidden;
}

function enterPocket() {
    closeSettings(false);
    closeDemo();
    pocketOn = true;
    el.pocket.hidden = false;
    syncLingerTick();
    syncInert();
    renderBubble();
    renderPocket();
    el.pocket.focus({ preventScroll: true });
}

function exitPocket() {
    if (!pocketOn) return;
    pocketOn = false;
    el.pocket.hidden = true;
    syncInert();
    renderAll();
    focusPanelPrimary();
}

function setLang(lang: Lang) {
    app.setLang(lang);
    sheetKey = '';
    applyStrings();
    renderAll();
    if (!el.settings.hidden) renderVoices();
}

function applyStrings() {
    html.lang = app.lang;
    document.querySelectorAll<HTMLElement>('[data-s]').forEach((n) => (n.textContent = s(n.dataset.s as Key)));
    document.querySelectorAll<HTMLElement>('[data-s-aria]').forEach((n) => n.setAttribute('aria-label', s(n.dataset.sAria as Key)));
    document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === app.lang)));
    $('start-label').textContent = app.guide ? t(app.lang, 'start') : s('loading');
    renderFollow();
}

function chime() {
    if (!audio) return;
    const now = audio.currentTime;
    [784, 1047].forEach((f, i) => {
        const o = audio!.createOscillator();
        const g = audio!.createGain();
        const t0 = now + i * 0.13;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        o.connect(g).connect(audio!.destination);
        o.start(t0);
        o.stop(t0 + 0.55);
    });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string) {
    const e = $('toast');
    e.textContent = msg;
    e.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => e.classList.remove('show'), 3200);
}

function esc(v: string) {
    return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Deslizar hacia abajo para descartar (tarjeta del Anuncio) o cerrar (ficha). */
function swipeDown(handle: HTMLElement, moving: HTMLElement, onDone: () => void, enabled: () => boolean = () => true) {
    let y0: number | null = null;
    let dy = 0;
    // Un arrastre no es un toque: el botón donde empezó no se pulsa.
    let dragged = false;
    handle.addEventListener(
        'click',
        (e) => {
            if (dragged) e.stopPropagation();
            dragged = false;
        },
        { capture: true },
    );
    handle.addEventListener('pointerdown', (e) => {
        dragged = false;
        if (!enabled() || e.button !== 0) return;
        y0 = e.clientY;
        dy = 0;
    });
    handle.addEventListener('pointermove', (e) => {
        if (y0 == null) return;
        dy = Math.max(0, e.clientY - y0);
        if (dy > 6) {
            moving.style.transition = 'none';
            moving.style.transform = `translateY(${dy}px)`;
        }
    });
    const end = () => {
        if (y0 == null) return;
        y0 = null;
        moving.style.transition = '';
        moving.style.transform = '';
        dragged = dy > 6;
        if (dy > 70) onDone();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------------------
// Eventos

$('start-btn').addEventListener('click', () => {
    try {
        audio = new AudioContext();
    } catch {
        audio = null;
    }
    app.start();
    document.body.classList.remove('pre');
    el.start.classList.add('leaving');
    setTimeout(() => {
        el.start.hidden = true;
        syncInert();
    }, reduceMotion.matches ? 0 : 320);
    renderAll();
    requestAnimationFrame(focusPanelPrimary);
});

document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));

el.upnext.addEventListener('click', () => queue[0] && openSheet(queue[0]));
$('card-close').addEventListener('click', () => dismissCard());
$('card-listen').addEventListener('click', () => card && listen(card.poi));
$('card-read').addEventListener('click', () => card && openSheet(card.poi));
$('pl-toggle').addEventListener('click', togglePause);
$('pl-stop').addEventListener('click', () => app.stop());
$('pl-title').addEventListener('click', () => narr && openSheet(narr.poi));
swipeDown(el.pCard, el.pCard, () => dismissCard(false));

el.bubble.addEventListener('click', () => app.selected && openSheet(app.selected));
$('sheet-close').addEventListener('click', () => closeSheet());
$('sheet-listen').addEventListener('click', () => sheetPoi && listen(sheetPoi));
$('sheet-toggle').addEventListener('click', togglePause);
$('sheet-stop').addEventListener('click', () => app.stop());
swipeDown($('sheet-grip'), el.sheet, () => closeSheet());

el.recenter.addEventListener('click', () => app.follow.recenter());
$('north-btn').addEventListener('click', () => app.follow.toggleNorth());
$('tilt-btn').addEventListener('click', () => app.follow.toggleTilt());
$('settings-btn').addEventListener('click', openSettings);
$('settings-close').addEventListener('click', () => closeSettings());
el.scrim.addEventListener('click', () => (el.confirm.hidden ? closeSettings() : closeConfirm()));
$('pocket-btn').addEventListener('click', enterPocket);
$('start-over').addEventListener('click', openConfirm);
$('confirm-cancel').addEventListener('click', () => closeConfirm());
$('confirm-ok').addEventListener('click', startOver);

$('demo-btn').addEventListener('click', () => toggleDemo());
document.querySelectorAll<HTMLButtonElement>('[data-close="demo"]').forEach((b) =>
    b.addEventListener('click', () => {
        closeDemo();
        $('demo-btn').focus({ preventScroll: true });
    }),
);
$('sim-toggle').addEventListener('click', () => {
    app.toggleSim();
    renderDemo();
});
$('sim-restart').addEventListener('click', () => {
    if (app.source !== 'sim') app.toggleSim();
    app.sim.restart();
    app.follow.recenter();
    renderDemo();
});
document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((b) =>
    b.addEventListener('click', () => {
        app.setProfile(b.dataset.profile as SpeedProfile);
        renderDemo();
    }),
);
document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) =>
    b.addEventListener('click', () => {
        app.sim.timeScale = Number(b.dataset.scale);
        renderDemo();
    }),
);
document.querySelectorAll<HTMLButtonElement>('[data-theme-force]').forEach((b) =>
    b.addEventListener('click', () => {
        forcedTheme = b.dataset.themeForce as typeof forcedTheme;
        evaluateDark();
        applyTheme();
    }),
);
$('gps-btn').addEventListener('click', () => {
    app.useGps();
    app.follow.recenter();
    toast(s('gpsOn'));
    renderDemo();
});

// Modo bolsillo: doble toque para salir (y Escape con teclado).
let lastTap = 0;
el.pocket.addEventListener('pointerup', (e) => {
    if (e.timeStamp - lastTap < 400) {
        lastTap = 0;
        exitPocket();
    } else lastTap = e.timeStamp;
});
el.pocket.addEventListener('dblclick', exitPocket);

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pocketOn) return exitPocket();
    if (!el.confirm.hidden) return closeConfirm();
    if (!el.settings.hidden) return closeSettings();
    if (!el.demo.hidden) {
        closeDemo();
        return $('demo-btn').focus({ preventScroll: true });
    }
    if (sheetPoi) return closeSheet();
    if (app.selected) app.select(null);
});

// El panel de demo se cierra al tocar fuera, como un menú.
document.addEventListener('pointerdown', (e) => {
    const target = e.target as Node;
    if (!el.demo.hidden && !el.demo.contains(target) && !$('demo-btn').contains(target)) closeDemo();
});


addEventListener('resize', placeBubble);

