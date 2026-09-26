// Mock B "Navegador": la guía como un navegador de coche. Panel inferior que
// cuenta la distancia al próximo POI, se convierte en la tarjeta del Anuncio
// al entrar en su radio y en el reproductor durante la Narración.
import './style.css';
import { distanceM, type Lang, type Poi } from '../../src/lib/kml';
import { MockApp, type MockUI } from '../shared/boot';
import { BANDS } from '../shared/follow';
import type { Fix, PoiState } from '../shared/guide';
import { drawIcon, type MapTheme } from '../shared/map';
import type { SpeedProfile } from '../shared/position';
import type { NarrationProgress } from '../shared/speech';
import { formatDistance, paragraphs, t, type StringKey } from '../shared/ui';

// ---------------------------------------------------------------- textos propios

const LOCAL = {
    es: {
        kmh: 'km/h',
        demo: 'Demo',
        step1: 'Pasa cerca de un lugar',
        step2: 'Oirás su nombre',
        step3: 'Toca Escuchar y te contará su historia',
        loading: 'Cargando lugares…',
        locating: 'Buscando tu posición…',
        noneLeft: 'No quedan lugares por anunciar cerca',
        leftBehind: 'Lo has dejado atrás',
        closesIn: 'Se cierra en {n} s',
        read: 'Leer',
        listenAgain: 'Volver a escuchar',
        narrating: 'Narrando',
        paused: 'En pausa',
        sentence: 'Frase {i} de {n}',
        andMore: 'y {n} más',
        announced: 'Anunciado',
        playingNow: 'Sonando',
        dismiss: 'Descartar',
        openPlace: 'Abrir ficha',
        pocketHint: 'Pantalla negra para llevar el móvil en el bolsillo. La guía sigue avisando.',
        pocketOn: 'Activar modo bolsillo',
        sessionHint: 'Los lugares anunciados en las últimas 12 horas vuelven a anunciarse.',
        resetSessionDo: 'Reiniciar',
        heardHint: 'Los lugares que ya escuchaste vuelven a anunciarse.',
        resetHeardDo: 'Borrar',
        sessionDone: 'Sesión reiniciada',
        heardDone: 'Escuchados borrados',
        guideActive: 'La guía sigue activa',
        demoTitle: 'Herramientas de demo',
        demoNote: 'Simulan tu movimiento para probar el mock. No forman parte de la app.',
        restart: 'Volver al inicio',
        profile: 'Velocidad del paseo',
        clock: 'Reloj acelerado',
        gpsActive: 'Usando tu GPS',
        headingUp: 'rumbo arriba',
        northUp: 'norte arriba',
        readout: '{band}: zoom {z}, {orient}. {follow}',
        following: 'La cámara te sigue.',
        notFollowing: 'Cámara libre.',
        compassNorth: 'N',
        compassAuto: 'Auto',
        walkEnded: 'Fin del paseo simulado',
    },
    en: {
        kmh: 'km/h',
        demo: 'Demo',
        step1: 'Walk past a place',
        step2: "You'll hear its name",
        step3: 'Tap Listen to hear its story',
        loading: 'Loading places…',
        locating: 'Finding your position…',
        noneLeft: 'No places left to announce nearby',
        leftBehind: "You've passed it",
        closesIn: 'Closes in {n} s',
        read: 'Read',
        listenAgain: 'Listen again',
        narrating: 'Narrating',
        paused: 'Paused',
        sentence: 'Sentence {i} of {n}',
        andMore: 'and {n} more',
        announced: 'Announced',
        playingNow: 'Playing',
        dismiss: 'Dismiss',
        openPlace: 'Open place',
        pocketHint: 'Black screen for carrying your phone in a pocket. The guide keeps announcing.',
        pocketOn: 'Turn on pocket mode',
        sessionHint: 'Places announced in the last 12 hours will be announced again.',
        resetSessionDo: 'Reset',
        heardHint: "Places you've heard will be announced again.",
        resetHeardDo: 'Clear',
        sessionDone: 'Session reset',
        heardDone: 'Heard places cleared',
        guideActive: 'The guide is still on',
        demoTitle: 'Demo tools',
        demoNote: 'They simulate your movement to try the mock. Not part of the app.',
        restart: 'Back to start',
        profile: 'Walk speed',
        clock: 'Fast clock',
        gpsActive: 'Using your GPS',
        headingUp: 'heading up',
        northUp: 'north up',
        readout: '{band}: zoom {z}, {orient}. {follow}',
        following: 'Camera follows you.',
        notFollowing: 'Camera is free.',
        compassNorth: 'N',
        compassAuto: 'Auto',
        walkEnded: 'Simulated walk finished',
    },
} satisfies Record<Lang, Record<string, string>>;

type LocalKey = keyof (typeof LOCAL)['es'];
type Key = LocalKey | StringKey;

let lang: Lang = 'es';
const s = (key: Key, vars: Record<string, string | number> = {}) => {
    const raw = key in LOCAL[lang] ? LOCAL[lang][key as LocalKey] : t(lang, key as StringKey);
    return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
};

// ---------------------------------------------------------------- iconos SVG

const svg = (body: string, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" ${extra}>${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
    play: svg('<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>'),
    pause: svg('<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
    stop: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>'),
    close: svg(`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" ${stroke} stroke-width="2.6"/>`),
    sliders: svg(`<path d="M4 7h9M18 7h2M4 17h3M12 17h8" ${stroke}/><circle cx="15.5" cy="7" r="2.5" ${stroke}/><circle cx="9.5" cy="17" r="2.5" ${stroke}/>`),
    locate: svg('<path d="M12 2.8l7.2 17.6L12 16.3l-7.2 4.1z" fill="currentColor"/>'),
    dir: svg('<path d="M12 2l7.5 9h-4.6v11h-5.8V11H4.5z" fill="currentColor"/>'),
    text: svg(`<path d="M5 6h14M5 10.5h14M5 15h14M5 19.5h8" ${stroke}/>`),
    chevronUp: svg(`<path d="M6.5 14.5L12 9l5.5 5.5" ${stroke} stroke-width="2.6"/>`),
    needle: svg('<path d="M12 2.5l4.2 9.5H7.8z" fill="currentColor"/><path d="M12 21.5l-4.2-9.5h8.4z" fill="currentColor" opacity=".35"/>'),
    walk: svg(
        `<circle cx="13.6" cy="4.2" r="2.1" fill="currentColor"/><path d="M10.4 21l2-6.3 3.2 3V21M8 12.6l2.6-4.4 3.3.9 2.6 3.4M11 8.4l1.4 6.3" ${stroke}/>`,
    ),
    bike: svg(`<circle cx="5.8" cy="16" r="3.6" ${stroke} stroke-width="2"/><circle cx="18.2" cy="16" r="3.6" ${stroke} stroke-width="2"/><path d="M5.8 16l3.8-7h6.2l2.4 7M9.6 9l2.6 7H5.8M14 5.5h2.6l-.8 3.5" ${stroke} stroke-width="2"/>`),
    car: svg(
        `<path d="M3.5 16.5v-3.6l2.1-5.4h12.8l2.1 5.4v3.6z" ${stroke} stroke-width="2"/><path d="M5 16.5v2.5M19 16.5v2.5" ${stroke} stroke-width="2.6"/><circle cx="7.5" cy="13.2" r="1.3" fill="currentColor"/><circle cx="16.5" cy="13.2" r="1.3" fill="currentColor"/>`,
    ),
};

// ---------------------------------------------------------------- tema del mapa

const COLORS = {
    ink: '#15181B',
    red: '#DF1B12',
    amber: '#FFB100',
    grey: '#8A9199',
    blue: '#1F6FEB',
};

/** Disco con aro blanco y sombra: se lee igual sobre el mapa claro y el oscuro. */
function disc(ctx: CanvasRenderingContext2D, s: number, r: number, fill: string) {
    const c = s / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.arc(c, c, r + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
}

let icons: Record<PoiState, ImageData> | null = null;
let puck: ImageData | null = null;

function buildIcons() {
    const S = 34;
    icons = {
        pending: drawIcon(S, (x, s) => {
            disc(x, s, 6.5, COLORS.ink);
            x.beginPath();
            x.arc(s / 2, s / 2, 2.2, 0, Math.PI * 2);
            x.fillStyle = '#FFFFFF';
            x.fill();
        }),
        announced: drawIcon(S, (x, s) => {
            disc(x, s, 7, COLORS.amber);
            x.beginPath();
            x.arc(s / 2, s / 2, 2.2, 0, Math.PI * 2);
            x.fillStyle = COLORS.ink;
            x.fill();
        }),
        heard: drawIcon(S, (x, s) => {
            disc(x, s, 5.5, COLORS.grey);
            x.beginPath();
            x.moveTo(s / 2 - 2.6, s / 2 + 0.1);
            x.lineTo(s / 2 - 0.7, s / 2 + 2);
            x.lineTo(s / 2 + 2.7, s / 2 - 1.9);
            x.strokeStyle = '#FFFFFF';
            x.lineWidth = 1.9;
            x.lineCap = 'round';
            x.lineJoin = 'round';
            x.stroke();
        }),
        playing: drawIcon(S, (x, s) => {
            disc(x, s, 10.5, COLORS.red);
            x.fillStyle = '#FFFFFF';
            const c = s / 2;
            [
                [-4.6, 2.8],
                [-1.15, 5.6],
                [2.3, 3.8],
            ].forEach(([dx, h]) => x.fillRect(c + dx, c - h, 2.4, h * 2));
        }),
    };
    puck = drawIcon(44, (x) => {
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
}

function theme(dark: boolean): MapTheme {
    if (!icons || !puck) buildIcons();
    return {
        icons: icons!,
        puck: puck!,
        label: dark ? { color: '#EEF0F2', halo: '#15181B', size: 13 } : { color: '#15181B', halo: '#FFFFFF', size: 13 },
        radius: dark ? { fill: 'rgba(255,255,255,0.03)', line: '#F4F5F6' } : { fill: 'rgba(21,24,27,0.025)', line: '#15181B' },
        cluster: dark ? { fill: '#F4F5F6', text: '#15181B', stroke: '#15181B' } : { fill: '#15181B', text: '#FFFFFF', stroke: '#FFFFFF' },
        accuracy: dark ? 'rgba(90,155,255,0.20)' : 'rgba(31,111,235,0.13)',
    };
}

// ---------------------------------------------------------------- DOM

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
    speedIcon: $('speedIcon'),
    speedNum: $('speedNum'),
    speedBand: $('speedBand'),
    demoTab: $<HTMLButtonElement>('demoTab'),
    demoDot: $('demoDot'),
    settingsBtn: $<HTMLButtonElement>('settingsBtn'),
    northBtn: $<HTMLButtonElement>('northBtn'),
    needle: $('needle'),
    compassMode: $('compassMode'),
    bubble: $<HTMLButtonElement>('bubble'),
    bubbleTitle: $('bubbleTitle'),
    bubbleMeta: $('bubbleMeta'),
    bubbleOpen: $('bubbleOpen'),
    recenter: $<HTMLButtonElement>('recenter'),
    stack: $('stack'),
    upnext: $('upnext'),
    upnextTitle: $('upnextTitle'),
    upnextMore: $('upnextMore'),
    panel: $('panel'),
    pNext: $('pNext'),
    nextBar: $('nextBar'),
    nextOpen: $<HTMLButtonElement>('nextOpen'),
    nextArrow: $('nextArrow'),
    nextDist: $('nextDist'),
    nextTitle: $('nextTitle'),
    pCard: $('pCard'),
    cardStatus: $('cardStatus'),
    cardStatusText: $('cardStatusText'),
    cardClose: $<HTMLButtonElement>('cardClose'),
    cardTitle: $('cardTitle'),
    cardBadge: $('cardBadge'),
    cardListen: $<HTMLButtonElement>('cardListen'),
    cardRead: $<HTMLButtonElement>('cardRead'),
    cardLinger: $('cardLinger'),
    lingerBar: $('lingerBar'),
    lingerText: $('lingerText'),
    pPlayer: $('pPlayer'),
    plBar: $('plBar'),
    plState: $('plState'),
    plStateText: $('plStateText'),
    plCount: $('plCount'),
    plTitle: $<HTMLButtonElement>('plTitle'),
    plTitleText: $('plTitleText'),
    plBadge: $('plBadge'),
    plToggle: $<HTMLButtonElement>('plToggle'),
    plStop: $<HTMLButtonElement>('plStop'),
    scrim: $('scrim'),
    sheet: $('sheet'),
    sheetDist: $('sheetDist'),
    sheetState: $('sheetState'),
    sheetClose: $<HTMLButtonElement>('sheetClose'),
    sheetTitle: $('sheetTitle'),
    sheetBadge: $('sheetBadge'),
    sheetListen: $<HTMLButtonElement>('sheetListen'),
    sheetStop: $<HTMLButtonElement>('sheetStop'),
    sheetBody: $('sheetBody'),
    settings: $('settings'),
    settingsClose: $<HTMLButtonElement>('settingsClose'),
    darkSwitch: $<HTMLButtonElement>('darkSwitch'),
    pocketBtn: $<HTMLButtonElement>('pocketBtn'),
    resetSession: $<HTMLButtonElement>('resetSession'),
    resetHeard: $<HTMLButtonElement>('resetHeard'),
    demo: $('demo'),
    demoClose: $<HTMLButtonElement>('demoClose'),
    simToggle: $<HTMLButtonElement>('simToggle'),
    simRestart: $<HTMLButtonElement>('simRestart'),
    useGps: $<HTMLButtonElement>('useGps'),
    demoReadout: $('demoReadout'),
    pocket: $('pocket'),
    pocketState: $('pocketState'),
    pocketDist: $('pocketDist'),
    pocketTitle: $('pocketTitle'),
    start: $('start'),
    startBtn: $<HTMLButtonElement>('startBtn'),
    toast: $('toast'),
    live: $('live'),
};

const iconLabel = (icon: string, label: string) => `${icon}<span>${label}</span>`;

// ---------------------------------------------------------------- estado de la interfaz

const LINGER_MS = 30_000;
/** Ventana de aproximación de la barra de distancia: se llena en los últimos 250 m hasta el radio. */
const APPROACH_M = 250;

let app: MockApp;
let ready = false;
/** Tarjeta del Anuncio: vive mientras estás dentro del radio y 30 s después de salir. */
let card: { poi: Poi; exitAt: number | null } | null = null;
let cardTimer: ReturnType<typeof setTimeout> | undefined;
let narr: Poi | null = null;
let progress: NarrationProgress | null = null;
let queue: Poi[] = [];
let sheetPoi: Poi | null = null;
let sheetKey = '';
let lastSelected: Poi | null = null;
let pocket = false;
let target: Poi | null = null;
let returnFocus: HTMLElement | null = null;
let audio: AudioContext | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** Para avisar cuando el paseo simulado llega al final (el simulador no lo notifica). */
let wasRunning = false;

const bandProfile = (i: number): SpeedProfile => (BANDS[i].name === 'walk' ? 'walk' : BANDS[i].name === 'bike' ? 'bike' : 'car');

function splitDistance(m: number | null) {
    const txt = formatDistance(m, lang);
    const i = txt.lastIndexOf(' ');
    return i < 0 ? { num: txt, unit: '' } : { num: txt.slice(0, i), unit: txt.slice(i + 1) };
}

function bearingTo(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
    const k = Math.cos((a.lat * Math.PI) / 180);
    return ((Math.atan2((b.lon - a.lon) * k, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
}

const effectiveRadius = (p: Poi) => Math.max(p.radius, 15);

/** El POI pendiente más próximo a su radio, del que aún estás fuera. */
function nextTarget(): Poi | null {
    const fix = app.fix;
    if (!fix) return null;
    let best: Poi | null = null;
    let bestEdge = Infinity;
    for (const p of app.pois) {
        if (app.guide.stateOf(p) !== 'pending' || app.guide.isInside(p)) continue;
        const edge = distanceM(p, fix) - effectiveRadius(p);
        if (edge < bestEdge) {
            bestEdge = edge;
            best = p;
        }
    }
    return best;
}

// ---------------------------------------------------------------- textos

function applyStrings() {
    document.documentElement.lang = lang;
    document.querySelectorAll<HTMLElement>('[data-t]').forEach((n) => (n.textContent = s(n.dataset.t as Key)));
    document.querySelectorAll<HTMLElement>('[data-t-aria]').forEach((n) => n.setAttribute('aria-label', s(n.dataset.tAria as Key)));
    document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
    el.startBtn.textContent = ready ? s('start') : s('loading');
    el.cardRead.innerHTML = iconLabel(ICON.text, s('read'));
    el.plStop.innerHTML = iconLabel(ICON.stop, s('stop'));
    el.sheetStop.innerHTML = iconLabel(ICON.stop, s('stop'));
    el.pocketBtn.textContent = s('pocketOn');
    el.nextOpen.setAttribute('aria-label', s('openPlace'));
    sheetKey = '';
    if (!ready) return;
    renderAll();
}

function setLang(next: Lang) {
    lang = next;
    if (ready) app.setLang(next);
    else {
        // setLang de MockApp toca el mapa, que aún no existe: antes del arranque solo cambiamos el idioma.
        app.lang = next;
        try {
            localStorage.setItem('btw-navegador:lang', next);
        } catch {
            /* sin almacenamiento */
        }
    }
    applyStrings();
}

// ---------------------------------------------------------------- render

function renderAll() {
    renderHud();
    renderPanel();
    renderBubble();
    if (sheetPoi) renderSheet();
    renderDemo();
    renderSettings();
    renderPocket();
}

function renderHud() {
    const f = app.follow;
    // Con el paseo simulado en pausa, la última posición aún lleva velocidad: mostramos 0.
    const kmh = app.source === 'sim' && !app.sim.running ? 0 : Math.round(f.kmh);
    el.speedNum.textContent = String(kmh);
    const profile = bandProfile(f.band);
    el.speedIcon.innerHTML = ICON[profile];
    el.speedBand.textContent = s(profile);
    el.recenter.hidden = f.active || !app.started;
    el.northBtn.setAttribute('aria-pressed', String(f.northLocked));
    el.northBtn.dataset.mode = f.northLocked ? 'north' : f.headingUp ? 'heading' : 'auto';
    el.compassMode.textContent = f.northLocked ? s('compassNorth') : '';
    el.northBtn.title = f.northLocked ? s('north') : f.headingUp ? s('headingUp') : s('northUp');
    renderCompass();
}

function renderCompass() {
    if (!ready) return;
    el.needle.style.transform = `rotate(${-app.map.ml.getBearing()}deg)`;
}

function renderPanel() {
    const mode = narr ? 'player' : card ? 'card' : 'next';
    el.panel.dataset.mode = mode;
    el.pNext.hidden = mode !== 'next';
    el.pCard.hidden = mode !== 'card';
    el.pPlayer.hidden = mode !== 'player';
    if (mode === 'next') renderNext();
    if (mode === 'card') renderCard();
    if (mode === 'player') renderPlayer();
    renderUpNext();
}

function renderNext() {
    target = nextTarget();
    const fix = app.fix;
    if (!fix || !target) {
        el.panel.classList.add('is-empty');
        el.nextDist.innerHTML = '';
        el.nextTitle.textContent = !fix ? s('locating') : s('noneLeft');
        el.nextBar.style.width = '0%';
        el.nextArrow.innerHTML = '';
        el.nextOpen.disabled = !target;
        return;
    }
    el.panel.classList.remove('is-empty');
    el.nextOpen.disabled = false;
    const d = distanceM(target, fix);
    const { num, unit } = splitDistance(d);
    el.nextDist.innerHTML = `<b>${num}</b><small>${unit}</small>`;
    const tx = app.text(target);
    el.nextTitle.textContent = tx.title;
    const edge = Math.max(0, d - effectiveRadius(target));
    el.nextBar.style.width = `${Math.round(Math.max(0, Math.min(1, 1 - edge / APPROACH_M)) * 100)}%`;
    if (!el.nextArrow.firstChild) el.nextArrow.innerHTML = ICON.dir;
    const rel = bearingTo(fix, target) - app.map.ml.getBearing();
    el.nextArrow.style.transform = `rotate(${rel}deg)`;
    el.nextOpen.setAttribute('aria-label', `${s('openPlace')}: ${tx.title}, ${formatDistance(d, lang)}`);
}

function renderCard() {
    if (!card) return;
    const tx = app.text(card.poi);
    el.cardTitle.textContent = tx.title;
    el.cardBadge.hidden = tx.lang === app.lang;
    const inside = card.exitAt == null;
    el.cardStatus.classList.toggle('is-left', !inside);
    el.cardStatusText.textContent = inside ? s('nearYou') : s('leftBehind');
    el.cardListen.innerHTML = iconLabel(ICON.play, app.guide.stateOf(card.poi) === 'heard' ? s('listenAgain') : s('listen'));
    el.cardLinger.hidden = inside;
    renderLinger();
}

function renderLinger() {
    if (!card || card.exitAt == null) return;
    const left = Math.max(0, LINGER_MS - (Date.now() - card.exitAt));
    el.lingerText.textContent = s('closesIn', { n: Math.ceil(left / 1000) });
    el.lingerBar.style.width = `${(left / LINGER_MS) * 100}%`;
}

function renderPlayer() {
    if (!narr) return;
    const tx = app.text(narr);
    const paused = app.narrator.paused;
    el.plTitleText.textContent = tx.title;
    el.plBadge.hidden = tx.lang === app.lang;
    el.plState.classList.toggle('is-paused', paused);
    el.plStateText.textContent = paused ? s('paused') : s('narrating');
    const p = progress ?? app.narrator.progress;
    const total = Math.max(1, p.total);
    const i = Math.min(p.index + 1, total);
    el.plCount.textContent = s('sentence', { i, n: total });
    el.plBar.style.width = `${(i / total) * 100}%`;
    el.plToggle.innerHTML = paused ? iconLabel(ICON.play, s('resume')) : iconLabel(ICON.pause, s('pause'));
    el.plToggle.classList.toggle('is-paused', paused);
}

function renderUpNext() {
    const first = queue[0];
    el.upnext.hidden = !first;
    if (!first) return;
    el.upnextTitle.textContent = app.text(first).title;
    el.upnextMore.textContent = queue.length > 1 ? s('andMore', { n: queue.length - 1 }) : '';
}

function stateLabel(state: PoiState) {
    return state === 'playing' ? s('playingNow') : state === 'heard' ? s('heard') : state === 'announced' ? s('announced') : '';
}

function renderBubble() {
    const poi = app.selected;
    const show = !!poi && !sheetPoi && !pocket;
    el.bubble.hidden = !show;
    if (!show || !poi) return;
    const tx = app.text(poi);
    el.bubbleTitle.textContent = tx.title;
    const state = app.guide.stateOf(poi);
    const bits = [formatDistance(app.distanceTo(poi), lang), stateLabel(state)].filter(Boolean);
    el.bubbleMeta.textContent = bits.join(', ');
    el.bubble.dataset.state = state;
    el.bubble.setAttribute('aria-label', `${s('openPlace')}: ${tx.title}`);
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
    const tip = Math.min(Math.max(p.x - left, 22), w - 22);
    const offscreen = p.x < 0 || p.x > window.innerWidth || p.y < 0 || p.y > window.innerHeight;
    el.bubble.style.visibility = offscreen ? 'hidden' : '';
    el.bubble.style.setProperty('--tip', `${Math.round(tip)}px`);
    el.bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(p.y - h - 22)}px)`;
}

function renderSheet() {
    const poi = sheetPoi;
    if (!poi) return;
    const tx = app.text(poi);
    const state = app.guide.stateOf(poi);
    el.sheetTitle.textContent = tx.title;
    el.sheetBadge.hidden = tx.lang === app.lang;
    el.sheetDist.textContent = formatDistance(app.distanceTo(poi), lang);
    el.sheetState.hidden = !stateLabel(state);
    el.sheetState.textContent = stateLabel(state);
    el.sheetState.dataset.state = state;
    const isPlaying = narr?.id === poi.id;
    if (isPlaying) {
        el.sheetListen.innerHTML = app.narrator.paused ? iconLabel(ICON.play, s('resume')) : iconLabel(ICON.pause, s('pause'));
    } else {
        el.sheetListen.innerHTML = iconLabel(ICON.play, state === 'heard' ? s('listenAgain') : s('listen'));
    }
    el.sheetStop.hidden = !isPlaying;
    const key = `${poi.id}|${lang}`;
    if (key !== sheetKey) {
        sheetKey = key;
        const paras = tx.description ? paragraphs(tx.description) : [];
        el.sheetBody.replaceChildren(
            ...(paras.length
                ? paras.map((p) => Object.assign(document.createElement('p'), { textContent: p }))
                : [Object.assign(document.createElement('p'), { textContent: s('noDescription'), className: 'empty' })]),
        );
        el.sheetBody.scrollTop = 0;
    }
}

function renderSettings() {
    el.darkSwitch.setAttribute('aria-checked', String(app.dark));
}

function renderDemo() {
    const running = app.source === 'sim' && app.sim.running;
    el.demoDot.classList.toggle('is-on', running || app.source === 'gps');
    el.simToggle.innerHTML = running ? iconLabel(ICON.pause, s('simPause')) : iconLabel(ICON.play, s('simulate'));
    document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.profile === app.sim.profile)));
    document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.scale) === app.sim.timeScale)));
    el.useGps.setAttribute('aria-pressed', String(app.source === 'gps'));
    el.useGps.textContent = app.source === 'gps' ? s('gpsActive') : s('useGps');
    const f = app.follow;
    el.demoReadout.textContent = s('readout', {
        band: s(bandProfile(f.band)),
        z: BANDS[f.band].zoom.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB'),
        orient: f.headingUp ? s('headingUp') : s('northUp'),
        follow: f.active ? s('following') : s('notFollowing'),
    });
}

function renderPocket() {
    if (!pocket) return;
    if (narr) {
        el.pocketState.textContent = app.narrator.paused ? s('paused') : s('narrating');
        el.pocketDist.textContent = '';
        el.pocketTitle.textContent = app.text(narr).title;
    } else if (card) {
        el.pocketState.textContent = card.exitAt == null ? s('nearYou') : s('leftBehind');
        el.pocketDist.textContent = '';
        el.pocketTitle.textContent = app.text(card.poi).title;
    } else {
        el.pocketState.textContent = s('guideActive');
        const d = target && app.fix ? distanceM(target, app.fix) : null;
        el.pocketDist.textContent = d != null ? formatDistance(d, lang) : '';
        el.pocketTitle.textContent = target ? app.text(target).title : '';
    }
}

// ---------------------------------------------------------------- acciones

function toast(msg: string) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.toast.hidden = true), 3200);
}

/** Campanilla suave: hay un Anuncio esperando a que termine la Narración. */
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

function dismissCard() {
    clearTimeout(cardTimer);
    card = null;
    renderPanel();
    renderPocket();
    el.nextOpen.focus({ preventScroll: true });
}

function listen(poi: Poi) {
    if (narr?.id === poi.id) {
        if (app.narrator.paused) app.resume();
        else app.pause();
        return;
    }
    app.narrate(poi);
}

function trapTarget() {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function restoreFocus() {
    if (returnFocus && document.contains(returnFocus) && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
}

/** Con un diálogo abierto, el resto de la pantalla no recibe foco ni lectores de pantalla. */
function syncInert() {
    const modal = !el.start.hidden || pocket || !!sheetPoi || !el.settings.hidden;
    for (const id of ['map', 'hud', 'bubble', 'dock']) $(id).inert = modal;
    el.sheet.inert = pocket || !el.settings.hidden;
}

function openSheet(poi: Poi) {
    trapTarget();
    sheetPoi = poi;
    if (app.selected?.id !== poi.id) app.select(poi);
    renderSheet();
    el.sheet.hidden = false;
    el.scrim.hidden = false;
    syncInert();
    renderBubble();
    if (!app.follow.active) app.map.flyToPoi(poi, Math.round(window.innerHeight * 0.62));
    el.sheetClose.focus({ preventScroll: true });
}

function closeSheet() {
    sheetPoi = null;
    el.sheet.hidden = true;
    el.scrim.hidden = true;
    app.select(null);
    syncInert();
    restoreFocus();
}

function openSettings() {
    trapTarget();
    closeDemo();
    renderSettings();
    el.settings.hidden = false;
    el.scrim.hidden = false;
    syncInert();
    el.settingsClose.focus({ preventScroll: true });
}

function closeSettings() {
    el.settings.hidden = true;
    el.scrim.hidden = !sheetPoi;
    syncInert();
    restoreFocus();
}

function toggleDemo(open = el.demo.hidden) {
    el.demo.hidden = !open;
    el.demoTab.setAttribute('aria-expanded', String(open));
    if (open) renderDemo();
}
const closeDemo = () => toggleDemo(false);

function enterPocket() {
    closeSettings();
    closeDemo();
    pocket = true;
    el.pocket.hidden = false;
    document.body.classList.add('in-pocket');
    syncInert();
    renderBubble();
    renderPocket();
    el.pocket.focus({ preventScroll: true });
}

function exitPocket() {
    if (!pocket) return;
    pocket = false;
    el.pocket.hidden = true;
    document.body.classList.remove('in-pocket');
    syncInert();
    renderAll();
    el.settingsBtn.focus({ preventScroll: true });
}

function start() {
    if (!ready) return;
    try {
        audio = new AudioContext();
    } catch {
        audio = null;
    }
    app.start();
    el.start.hidden = true;
    document.body.classList.remove('is-start');
    syncInert();
    renderAll();
    el.nextOpen.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- MockUI

const ui: MockUI = {
    name: 'navegador',
    theme,
    bottomInset() {
        const top = el.stack.getBoundingClientRect().top;
        return Math.max(0, Math.round(window.innerHeight - top + 12));
    },
    onReady(a) {
        ready = true;
        const ml = a.map.ml;
        ml.on('move', placeBubble);
        ml.on('rotate', () => {
            renderCompass();
            if (!narr && !card) renderNext();
        });
        el.startBtn.disabled = false;
        el.startBtn.textContent = s('start');
        renderAll();
    },
    onAnnounce(poi) {
        clearTimeout(cardTimer);
        card = { poi, exitAt: app.guide.isInside(poi) ? null : Date.now() };
        el.live.textContent = app.text(poi).title;
        renderPanel();
        renderPocket();
    },
    onExit(poi) {
        if (card?.poi.id === poi.id && card.exitAt == null) {
            card.exitAt = Date.now();
            clearTimeout(cardTimer);
            cardTimer = setTimeout(() => {
                if (card?.poi.id === poi.id) {
                    card = null;
                    renderPanel();
                    renderPocket();
                }
            }, LINGER_MS);
            renderPanel();
            renderPocket();
        }
    },
    onQueue(q) {
        // Una Entrada nueva espera a que termine la Narración: aviso visual y campanilla.
        if (q.length > queue.length && narr) chime();
        queue = q;
        renderUpNext();
    },
    onStates() {
        if (!ready) return;
        if (app.selected !== lastSelected) {
            lastSelected = app.selected;
            renderBubble();
        } else if (!el.bubble.hidden) renderBubble();
        if (sheetPoi) renderSheet();
        if (!narr && !card) renderNext();
        if (card) renderCard();
    },
    onFix(_fix: Fix) {
        renderHud();
        if (!narr && !card) renderNext();
        if (!el.bubble.hidden) renderBubble();
        if (sheetPoi) el.sheetDist.textContent = formatDistance(app.distanceTo(sheetPoi), lang);
        if (!el.demo.hidden) renderDemo();
        renderPocket();
    },
    onFollowChange() {
        renderHud();
        if (!el.demo.hidden) renderDemo();
    },
    onNarration(poi, p) {
        narr = poi;
        progress = p;
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
        if (!ready) el.startBtn.textContent = message;
        toast(message);
    },
};

// ---------------------------------------------------------------- eventos

el.settingsBtn.innerHTML = ICON.sliders;
el.needle.innerHTML = ICON.needle;
el.bubbleOpen.innerHTML = ICON.chevronUp;
el.cardClose.innerHTML = ICON.close;
el.sheetClose.innerHTML = ICON.close;
el.settingsClose.innerHTML = ICON.close;
el.demoClose.innerHTML = ICON.close;
document.querySelector('.recenter-icon')!.innerHTML = ICON.locate;

el.startBtn.addEventListener('click', start);
document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));

el.recenter.addEventListener('click', () => app.follow.recenter());
el.northBtn.addEventListener('click', () => app.follow.toggleNorth());
el.settingsBtn.addEventListener('click', openSettings);
el.settingsClose.addEventListener('click', closeSettings);
el.demoTab.addEventListener('click', () => toggleDemo());
el.demoClose.addEventListener('click', closeDemo);

el.bubble.addEventListener('click', () => app.selected && openSheet(app.selected));
el.nextOpen.addEventListener('click', () => target && openSheet(target));
el.cardClose.addEventListener('click', dismissCard);
el.cardListen.addEventListener('click', () => card && listen(card.poi));
el.cardRead.addEventListener('click', () => card && openSheet(card.poi));
el.plToggle.addEventListener('click', () => narr && listen(narr));
el.plStop.addEventListener('click', () => app.stop());
el.plTitle.addEventListener('click', () => narr && openSheet(narr));

el.sheetClose.addEventListener('click', closeSheet);
el.sheetListen.addEventListener('click', () => sheetPoi && listen(sheetPoi));
el.sheetStop.addEventListener('click', () => app.stop());
el.scrim.addEventListener('click', () => (el.settings.hidden ? closeSheet() : closeSettings()));

el.darkSwitch.addEventListener('click', () => {
    app.setDark(!app.dark);
    document.body.classList.toggle('dark', app.dark);
    renderSettings();
});
el.pocketBtn.addEventListener('click', enterPocket);
el.resetSession.addEventListener('click', () => {
    app.guide.resetSession();
    toast(s('sessionDone'));
});
el.resetHeard.addEventListener('click', () => {
    app.guide.resetHeard();
    toast(s('heardDone'));
});

el.simToggle.addEventListener('click', () => {
    app.toggleSim();
    wasRunning = app.sim.running;
    renderHud();
    renderDemo();
});
el.simRestart.addEventListener('click', () => {
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
el.useGps.addEventListener('click', () => {
    app.useGps();
    wasRunning = false;
    renderDemo();
});

// Modo bolsillo: doble toque para salir (dblclick no llega fiable en táctil).
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
    if (pocket) exitPocket();
    else if (!el.settings.hidden) closeSettings();
    else if (sheetPoi) closeSheet();
    else if (!el.demo.hidden) closeDemo();
    else if (app.selected) app.select(null);
});

// Reloj de 1 s: cuenta atrás de la tarjeta y estado del simulador (no avisa al terminar).
setInterval(() => {
    if (!ready) return;
    if (card?.exitAt != null) renderLinger();
    const running = app.source === 'sim' && app.sim.running;
    if (wasRunning && !running && app.started) toast(s('walkEnded'));
    wasRunning = running;
    renderDemo();
}, 1000);

// ---------------------------------------------------------------- arranque

app = new MockApp(ui);
lang = app.lang;
document.body.classList.toggle('dark', app.dark);
document.body.classList.add('is-start');
(window as unknown as { app: MockApp }).app = app;
applyStrings();
syncInert();
void app.boot('map');
