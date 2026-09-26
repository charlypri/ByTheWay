// Mock A "Editorial": la guía como un cuaderno de viaje impreso.
// La ficha del POI es una página de libro (Descripción en Noto Serif); el resto, discreto.
import './style.css';
import type { Lang, Poi } from '../../src/lib/kml';
import { MockApp, type MockUI } from '../shared/boot';
import { BANDS } from '../shared/follow';
import type { PoiState } from '../shared/guide';
import { drawIcon, type MapTheme } from '../shared/map';
import type { SpeedProfile } from '../shared/position';
import { splitSentences, type NarrationProgress } from '../shared/speech';
import { formatDistance, paragraphs, t, type StringKey } from '../shared/ui';

// ---------------------------------------------------------------- textos propios

const ES = {
    tagline: 'Una guía de bolsillo que te cuenta lo que tienes delante mientras paseas.',
    legendTitle: 'Cómo leer el mapa',
    legendPending: 'Por descubrir',
    legendAnnounced: 'Anunciado hoy',
    legendPlaying: 'Sonando ahora',
    loading: 'Cargando el mapa…',
    guideOn: 'Guía en marcha',
    read: 'Leer',
    dismiss: 'Descartar',
    movedOn: 'Te has alejado',
    sentence: 'Frase {i} de {n}',
    listening: 'Escuchando',
    paused: 'En pausa',
    listenAgain: 'Escuchar otra vez',
    nowPlaying: 'Sonando ahora',
    minutes: 'Unos {n} min de escucha',
    place: 'Página {n} de {total}',
    moreQueue: 'y {n} más',
    headingUp: 'Rumbo arriba',
    demo: 'Demo',
    demoTitle: 'Herramientas de demo',
    demoNote: 'Solo en este prototipo: simulan un paseo por el Retiro.',
    profile: 'Perfil de velocidad',
    clock: 'Reloj del paseo',
    restart: 'Volver a la salida',
    gpsOn: 'Usando tu GPS',
    readout: 'Vas a {kmh} km/h; el mapa usa zoom {z} con {mode}.',
    modeNorth: 'el norte arriba',
    modeHeading: 'tu rumbo arriba',
    notFollowing: 'Has movido el mapa: pulsa Recentrar para volver a seguirte.',
    darkHint: 'Mejor de noche o con mucho sol en contra.',
    pocketEnter: 'Pasar a modo bolsillo',
    pocketHint: 'Pantalla en negro. La guía sigue avisándote de cada lugar.',
    pocketAlive: 'Bytheway sigue contigo',
    resetSessionHint: 'Los lugares anunciados en las últimas 12 horas se podrán anunciar de nuevo.',
    resetHeardHint: 'Quita la marca de escuchado de todos los lugares.',
    reset: 'Reiniciar',
    clear: 'Borrar',
    sessionDone: 'Sesión reiniciada',
    heardDone: 'Escuchados borrados',
    openSheet: 'Abrir la ficha de {title}',
};
type LocalKey = keyof typeof ES;
const EN: Record<LocalKey, string> = {
    tagline: 'A pocket guide that tells you about what’s in front of you as you walk.',
    legendTitle: 'How to read the map',
    legendPending: 'Still to discover',
    legendAnnounced: 'Announced today',
    legendPlaying: 'Playing now',
    loading: 'Loading the map…',
    guideOn: 'Guide is on',
    read: 'Read',
    dismiss: 'Dismiss',
    movedOn: 'You’ve moved on',
    sentence: 'Sentence {i} of {n}',
    listening: 'Listening',
    paused: 'Paused',
    listenAgain: 'Listen again',
    nowPlaying: 'Playing now',
    minutes: 'About {n} min to listen',
    place: 'Page {n} of {total}',
    moreQueue: 'and {n} more',
    headingUp: 'Heading up',
    demo: 'Demo',
    demoTitle: 'Demo tools',
    demoNote: 'Prototype only: they simulate a walk through the Retiro.',
    profile: 'Speed profile',
    clock: 'Walk clock',
    restart: 'Back to the start',
    gpsOn: 'Using your GPS',
    readout: 'You’re at {kmh} km/h; the map uses zoom {z} with {mode}.',
    modeNorth: 'north up',
    modeHeading: 'your heading up',
    notFollowing: 'You moved the map: tap Recenter to follow you again.',
    darkHint: 'Better at night or with bright sun behind you.',
    pocketEnter: 'Switch to pocket mode',
    pocketHint: 'Black screen. The guide keeps telling you about each place.',
    pocketAlive: 'Bytheway is still with you',
    resetSessionHint: 'Places announced in the last 12 hours can be announced again.',
    resetHeardHint: 'Removes the heard mark from every place.',
    reset: 'Reset',
    clear: 'Clear',
    sessionDone: 'Session reset',
    heardDone: 'Heard places cleared',
    openSheet: 'Open the page for {title}',
};
const LOCAL: Record<Lang, Record<LocalKey, string>> = { es: ES, en: EN };
type Key = LocalKey | StringKey;

let lang: Lang = 'es';
const str = (k: Key, vars: Record<string, string | number> = {}) => {
    const raw = k in ES ? LOCAL[lang][k as LocalKey] : t(lang, k as StringKey);
    return raw.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? ''));
};

// ---------------------------------------------------------------- símbolos del mapa

/** Colores de imprenta: los iconos no cambian con el mapa oscuro, así que llevan halo claro y filo oscuro. */
const PRINT = { green: '#1E4632', gilt: '#B28A38', granite: '#848B86', ink: '#1F2A31', halo: '#FBFBF8', edge: 'rgba(10,16,13,0.55)' };
const TAU = Math.PI * 2;

function disc(ctx: CanvasRenderingContext2D, c: number, r: number, fill: string) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
}
/** Filo oscuro + halo claro: se lee sobre monoLight y monoDark. */
function mount(ctx: CanvasRenderingContext2D, c: number, r: number) {
    disc(ctx, c, r + 2.8, PRINT.edge);
    disc(ctx, c, r + 2.1, PRINT.halo);
}

const SYMBOLS: Record<PoiState, { size: number; draw: (ctx: CanvasRenderingContext2D, s: number) => void }> = {
    // ⊙ lugar por descubrir: disco verde con punto, como los símbolos de monumento de una guía impresa
    pending: {
        size: 24,
        draw(ctx, s) {
            const c = s / 2;
            mount(ctx, c, 7.4);
            disc(ctx, c, 7.4, PRINT.green);
            disc(ctx, c, 2.3, PRINT.halo);
        },
    },
    // ○ anunciado: el mismo símbolo, abierto
    announced: {
        size: 24,
        draw(ctx, s) {
            const c = s / 2;
            mount(ctx, c, 7.4);
            disc(ctx, c, 7.4, PRINT.green);
            disc(ctx, c, 4.5, PRINT.halo);
        },
    },
    // escuchado: más pequeño, granito, con señal
    heard: {
        size: 18,
        draw(ctx, s) {
            const c = s / 2;
            mount(ctx, c, 5.2);
            disc(ctx, c, 5.2, PRINT.granite);
            ctx.beginPath();
            ctx.moveTo(c - 2.4, c + 0.1);
            ctx.lineTo(c - 0.6, c + 1.9);
            ctx.lineTo(c + 2.6, c - 1.7);
            ctx.strokeStyle = PRINT.halo;
            ctx.lineWidth = 1.5;
            ctx.lineCap = ctx.lineJoin = 'round';
            ctx.stroke();
        },
    },
    // sonando: la estrella de las guías clásicas, en dorado
    playing: {
        size: 28,
        draw(ctx, s) {
            const c = s / 2;
            mount(ctx, c, 9);
            disc(ctx, c, 9, PRINT.gilt);
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const r = i % 2 ? 2.4 : 5.6;
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                ctx.lineTo(c + r * Math.cos(a), c + r * Math.sin(a));
            }
            ctx.closePath();
            ctx.fillStyle = PRINT.halo;
            ctx.fill();
        },
    },
};

/** "Usted está aquí": disco de hierro con una flecha de rumbo; la capa lo gira con el rumbo. */
function drawPuck(ctx: CanvasRenderingContext2D, s: number) {
    const c = s / 2;
    disc(ctx, c, 11.6, 'rgba(31,42,49,0.18)');
    disc(ctx, c, 10.2, PRINT.edge);
    disc(ctx, c, 9.5, PRINT.halo);
    disc(ctx, c, 7.8, PRINT.ink);
    ctx.beginPath();
    ctx.moveTo(c, c - 5);
    ctx.lineTo(c + 3.9, c + 4);
    ctx.lineTo(c, c + 2);
    ctx.lineTo(c - 3.9, c + 4);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.fillStyle = PRINT.halo;
    ctx.fill();
}

const ICONS = Object.fromEntries(
    (Object.keys(SYMBOLS) as PoiState[]).map((k) => [k, drawIcon(SYMBOLS[k].size, SYMBOLS[k].draw)]),
) as Record<PoiState, ImageData>;
const PUCK = drawIcon(26, drawPuck);

function theme(dark: boolean): MapTheme {
    return dark
        ? {
              icons: ICONS,
              puck: PUCK,
              label: { color: '#E3E7E1', halo: '#141916', size: 12 },
              radius: { fill: 'rgba(143,188,160,0.10)', line: '#8FBCA0' },
              cluster: { fill: '#2E5E44', text: '#F1F4EF', stroke: '#DDE3DC' },
              accuracy: 'rgba(227,231,225,0.10)',
          }
        : {
              icons: ICONS,
              puck: PUCK,
              label: { color: '#1C2327', halo: '#FBFBF8', size: 12 },
              radius: { fill: 'rgba(30,70,50,0.07)', line: '#2F6247' },
              cluster: { fill: '#1E4632', text: '#FBFBF8', stroke: '#FBFBF8' },
              accuracy: 'rgba(31,42,49,0.09)',
          };
}

// ---------------------------------------------------------------- DOM

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
    start: $('start'),
    startBtn: $<HTMLButtonElement>('start-btn'),
    startLabel: $('start-label'),
    topbar: $('topbar'),
    demoBtn: $<HTMLButtonElement>('demo-btn'),
    demoPanel: $('demo-panel'),
    simToggle: $<HTMLButtonElement>('sim-toggle'),
    simToggleLabel: $('sim-toggle-label'),
    simRestart: $<HTMLButtonElement>('sim-restart'),
    gpsBtn: $<HTMLButtonElement>('gps-btn'),
    readout: $('demo-readout'),
    pocketBtn: $<HTMLButtonElement>('pocket-btn'),
    settingsBtn: $<HTMLButtonElement>('settings-btn'),
    northBtn: $<HTMLButtonElement>('north-btn'),
    needle: $('needle') as unknown as SVGElement,
    northMode: $('north-mode'),
    recenter: $<HTMLButtonElement>('recenter'),
    bubble: $<HTMLButtonElement>('bubble'),
    bubbleTitle: $('bubble-title'),
    bubbleMeta: $('bubble-meta'),
    scrim: $('scrim'),
    sheet: $('sheet'),
    sheetGrip: $('sheet-grip'),
    sheetClose: $<HTMLButtonElement>('sheet-close'),
    sheetScroll: $('sheet-scroll'),
    sheetWhere: $('sheet-where'),
    sheetTitle: $('sheet-title'),
    sheetBadges: $('sheet-badges'),
    sheetListen: $<HTMLButtonElement>('sheet-listen'),
    sheetListenLabel: $('sheet-listen-label'),
    sheetLength: $('sheet-length'),
    sheetProse: $('sheet-prose'),
    sheetFolio: $('sheet-folio'),
    stack: $('stack'),
    queue: $('queue'),
    queueTitle: $('queue-title'),
    queueMore: $('queue-more'),
    card: $('card'),
    cardWhere: $('card-where'),
    cardOpen: $<HTMLButtonElement>('card-open'),
    cardBadges: $('card-badges'),
    cardListen: $<HTMLButtonElement>('card-listen'),
    cardRead: $<HTMLButtonElement>('card-read'),
    cardClose: $<HTMLButtonElement>('card-close'),
    cardTimer: $('card-timer'),
    player: $('player'),
    playerBar: $('player-bar'),
    playerToggle: $<HTMLButtonElement>('player-toggle'),
    playerToggleIcon: document.getElementById('player-toggle-icon') as unknown as SVGUseElement,
    playerInfo: $<HTMLButtonElement>('player-info'),
    playerState: $('player-state'),
    playerTitle: $('player-title'),
    playerProgress: $('player-progress'),
    playerStop: $<HTMLButtonElement>('player-stop'),
    status: $('status'),
    settings: $<HTMLDialogElement>('settings'),
    settingsClose: $<HTMLButtonElement>('settings-close'),
    darkToggle: $<HTMLInputElement>('dark-toggle'),
    pocketEnter: $<HTMLButtonElement>('pocket-enter'),
    resetSession: $<HTMLButtonElement>('reset-session'),
    resetHeard: $<HTMLButtonElement>('reset-heard'),
    pocket: $('pocket'),
    pocketAlive: $('pocket-alive'),
    pocketNow: $('pocket-now'),
    toast: $('toast'),
};

// ---------------------------------------------------------------- estado de la interfaz

const CARD_LINGER_MS = 30_000;
let app: MockApp;
let ready = false;
let bubblePoi: Poi | null = null;
let sheetPoi: Poi | null = null;
let sheetOpener: HTMLElement | null = null;
let followBeforeSheet = false;
let cardPoi: Poi | null = null;
let cardTimer: ReturnType<typeof setTimeout> | null = null;
let queue: Poi[] = [];
let narrating: Poi | null = null;
let progress: NarrationProgress | null = null;
let pocketOn = false;
let lastAnnounced: Poi | null = null;
let audio: AudioContext | null = null;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const displayTitle = (poi: Poi) => app.text(poi).title.replace(/\.\s*$/, '');
const onlySpanish = (poi: Poi) => app.text(poi).lang !== app.lang;
const folio = (poi: Poi) => app.pois.indexOf(poi) + 1;

function whereText(poi: Poi) {
    if (app.guide.isInside(poi)) return t(lang, 'nearYou');
    const d = app.distanceTo(poi);
    if (d == null) return '';
    const f = formatDistance(d, lang);
    return lang === 'es' ? `A ${f} ${t(lang, 'away')}` : `${f} ${t(lang, 'away')}`;
}

function badge(text: string, kind: 'lang' | 'heard') {
    const b = document.createElement('span');
    b.className = `badge badge--${kind}`;
    if (kind === 'heard') b.innerHTML = '<svg aria-hidden="true"><use href="#i-check"/></svg>';
    b.append(text);
    return b;
}

function fillBadges(target: HTMLElement, poi: Poi, withHeard: boolean) {
    target.replaceChildren();
    if (withHeard && app.guide.stateOf(poi) === 'heard') target.append(badge(t(lang, 'heard'), 'heard'));
    if (onlySpanish(poi)) target.append(badge(t(lang, 'onlyInSpanish'), 'lang'));
    target.hidden = !target.childElementCount;
}

function toast(message: string) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout((toast as unknown as { h?: number }).h);
    (toast as unknown as { h?: number }).h = window.setTimeout(() => (el.toast.hidden = true), 3800);
}

/** Campanilla suave: hay un Anuncio esperando a que termine la Narración. */
function chime() {
    if (!audio) return;
    const now = audio.currentTime;
    for (const [freq, delay] of [
        [987.8, 0],
        [1318.5, 0.14],
    ]) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.05, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.7);
        osc.connect(gain).connect(audio.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.75);
    }
}

// ---------------------------------------------------------------- textos estáticos e idioma

function applyStrings() {
    document.documentElement.lang = lang;
    document.querySelectorAll<HTMLElement>('[data-t]').forEach((n) => (n.textContent = str(n.dataset.t as Key)));
    document.querySelectorAll<HTMLElement>('[data-t-label]').forEach((n) => {
        n.setAttribute('aria-label', str(n.dataset.tLabel as Key));
        if (n.tagName === 'BUTTON') n.title = str(n.dataset.tLabel as Key);
    });
    document.querySelectorAll<HTMLElement>('[data-t-region]').forEach((n) => n.setAttribute('aria-label', str(n.dataset.tRegion as Key)));
    el.startLabel.textContent = ready ? t(lang, 'start') : str('loading');
    el.northBtn.setAttribute('aria-label', t(lang, 'north'));
    el.northBtn.title = t(lang, 'north');
    document.querySelectorAll<HTMLInputElement>('input[name="lang"], input[name="lang-start"]').forEach((i) => (i.checked = i.value === lang));
    if (!ready) return;
    renderAll();
}

function setLang(next: Lang) {
    lang = next;
    if (ready) app.setLang(next);
    else if (app) app.lang = next;
    applyStrings();
}

// ---------------------------------------------------------------- burbuja

function renderBubble() {
    const poi = bubblePoi;
    el.bubble.hidden = !poi || !!sheetPoi || pocketOn;
    if (!poi) return;
    el.bubbleTitle.textContent = displayTitle(poi);
    const st = app.guide.stateOf(poi);
    el.bubbleMeta.textContent = st === 'playing' ? str('nowPlaying') : st === 'heard' ? t(lang, 'heard') : whereText(poi);
    el.bubble.dataset.state = st;
    el.bubble.setAttribute('aria-label', str('openSheet', { title: displayTitle(poi) }));
    placeBubble();
}

function placeBubble() {
    if (!bubblePoi || el.bubble.hidden) return;
    const p = app.map.ml.project([bubblePoi.lon, bubblePoi.lat]);
    const offset = app.guide.stateOf(bubblePoi) === 'playing' ? 22 : 17;
    el.bubble.style.transform = `translate(${p.x}px, ${p.y - offset}px) translate(-50%, -100%)`;
}

// ---------------------------------------------------------------- ficha (página)

function sentenceRanges(description: string) {
    // La frase 0 es el título; luego cada párrafo aporta sus frases.
    let at = 1;
    return paragraphs(description).map((p) => {
        const n = Math.max(splitSentences(p).length, 1);
        const range = [at, at + n - 1] as const;
        at += n;
        return range;
    });
}

function openSheet(poi: Poi, opener: HTMLElement | null) {
    const wasOpen = !!sheetPoi;
    sheetPoi = poi;
    sheetOpener = opener;
    if (!wasOpen) followBeforeSheet = app.follow.active;
    if (app.follow.active) {
        // Leer una ficha es explorar: el seguimiento se suspende y se recupera al cerrar.
        app.follow.suspend();
    }
    if (app.selected?.id !== poi.id) app.select(poi);
    buildSheet();
    el.sheet.classList.add('is-open');
    el.scrim.classList.add('is-open');
    el.sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    el.sheetScroll.scrollTop = 0;
    el.sheet.classList.remove('is-scrolled');
    renderBubble();
    renderFollow();
    requestAnimationFrame(() => {
        app.map.flyToPoi(poi, el.sheet.getBoundingClientRect().height + 8);
        el.sheetTitle.focus({ preventScroll: true });
    });
}

function closeSheet() {
    if (!sheetPoi) return;
    sheetPoi = null;
    el.sheet.classList.remove('is-open');
    el.scrim.classList.remove('is-open');
    el.sheet.setAttribute('aria-hidden', 'true');
    el.sheet.style.transform = '';
    document.body.classList.remove('sheet-open');
    app.select(null);
    if (followBeforeSheet) app.follow.recenter();
    renderFollow();
    const back = sheetOpener && document.contains(sheetOpener) && !sheetOpener.closest('[hidden]') ? sheetOpener : el.settingsBtn;
    back.focus({ preventScroll: true });
}

function buildSheet() {
    const poi = sheetPoi;
    if (!poi) return;
    const text = app.text(poi);
    el.sheetTitle.textContent = displayTitle(poi);
    el.sheetProse.lang = text.lang;
    el.sheetTitle.lang = text.lang;
    const ps = paragraphs(text.description);
    el.sheetProse.replaceChildren(
        ...(ps.length ? ps : [t(lang, 'noDescription')]).map((p) => {
            const node = document.createElement('p');
            node.textContent = p;
            return node;
        }),
    );
    el.sheetProse.classList.toggle('prose--empty', !ps.length);
    el.sheetListen.hidden = !ps.length;
    const words = text.description.split(/\s+/).filter(Boolean).length;
    el.sheetLength.textContent = ps.length ? str('minutes', { n: Math.max(1, Math.round(words / 150)) }) : '';
    el.sheetFolio.textContent = String(folio(poi));
    el.sheetFolio.setAttribute('aria-label', str('place', { n: folio(poi), total: app.pois.length }));
    refreshSheet();
}

function refreshSheet() {
    const poi = sheetPoi;
    if (!poi) return;
    const st = app.guide.stateOf(poi);
    el.sheetWhere.textContent = whereText(poi);
    fillBadges(el.sheetBadges, poi, true);
    const playing = narrating?.id === poi.id;
    el.sheet.classList.toggle('is-playing', playing);
    el.sheetListen.disabled = playing;
    el.sheetListenLabel.textContent = playing ? str('nowPlaying') : st === 'heard' ? str('listenAgain') : t(lang, 'listen');
    // Marca de lectura en el margen, como un lápiz siguiendo la línea.
    const ranges = sentenceRanges(app.text(poi).description);
    const i = playing && progress ? progress.index : -1;
    [...el.sheetProse.children].forEach((p, k) => {
        const on = i >= ranges[k]?.[0] && i <= ranges[k]?.[1];
        p.classList.toggle('is-reading', on);
        if (on) p.setAttribute('aria-current', 'true');
        else p.removeAttribute('aria-current');
    });
}

// Arrastrar la página hacia abajo la cierra.
function wireSheetDrag() {
    let startY = 0;
    let dy = 0;
    let dragging = false;
    const handles = [el.sheetGrip, el.sheet.querySelector<HTMLElement>('.page__head')!];
    const down = (e: PointerEvent) => {
        dragging = true;
        startY = e.clientY;
        dy = 0;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        el.sheet.classList.add('is-dragging');
    };
    const move = (e: PointerEvent) => {
        if (!dragging) return;
        dy = Math.max(0, e.clientY - startY);
        el.sheet.style.transform = `translateY(${dy}px)`;
    };
    const up = () => {
        if (!dragging) return;
        dragging = false;
        el.sheet.classList.remove('is-dragging');
        el.sheet.style.transform = '';
        if (dy > 90) closeSheet();
    };
    for (const h of handles) {
        h.addEventListener('pointerdown', down);
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
    }
}

// ---------------------------------------------------------------- Anuncio

function showCard(poi: Poi) {
    cardPoi = poi;
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
    el.card.classList.remove('is-leaving');
    el.card.classList.remove('is-new');
    void el.card.offsetWidth;
    el.card.classList.add('is-new');
    renderCard();
}

function hideCard() {
    cardPoi = null;
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
    renderCard();
}

function renderCard() {
    const poi = cardPoi;
    el.card.hidden = !poi;
    if (poi) {
        el.cardOpen.textContent = displayTitle(poi);
        el.cardOpen.lang = app.text(poi).lang;
        const inside = app.guide.isInside(poi);
        el.cardWhere.textContent = inside ? t(lang, 'nearYou') : str('movedOn');
        el.card.classList.toggle('is-leaving', !inside && !!cardTimer);
        fillBadges(el.cardBadges, poi, false);
    }
    renderStack();
}

// ---------------------------------------------------------------- reproductor y cola

function renderPlayer() {
    const poi = narrating;
    el.player.hidden = !poi;
    if (poi && progress) {
        const paused = app.narrator.paused;
        el.playerTitle.textContent = displayTitle(poi);
        el.playerTitle.lang = app.text(poi).lang;
        el.playerState.textContent = paused ? str('paused') : str('listening');
        const i = Math.min(progress.index + 1, progress.total);
        el.playerProgress.textContent = str('sentence', { i, n: progress.total });
        el.playerBar.style.width = `${(i / Math.max(progress.total, 1)) * 100}%`;
        el.playerToggle.setAttribute('aria-label', paused ? t(lang, 'resume') : t(lang, 'pause'));
        el.playerToggle.title = paused ? t(lang, 'resume') : t(lang, 'pause');
        el.playerToggleIcon.setAttribute('href', paused ? '#i-play' : '#i-pause');
        el.player.classList.toggle('is-paused', paused);
    }
    renderStack();
}

function renderQueue() {
    const next = queue[0];
    el.queue.hidden = !next;
    if (next) {
        el.queueTitle.textContent = displayTitle(next);
        el.queueMore.textContent = queue.length > 1 ? str('moreQueue', { n: queue.length - 1 }) : '';
    }
    renderStack();
}

function renderStack() {
    el.status.hidden = !!(narrating || cardPoi || queue.length) || !app?.started;
    requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--stack-h', `${stackHeight()}px`);
        renderPocket();
    });
}

function stackHeight() {
    const top = el.stack.getBoundingClientRect().top;
    return Math.max(0, window.innerHeight - top);
}

// ---------------------------------------------------------------- seguimiento y brújula

function renderFollow() {
    if (!ready) return;
    el.recenter.hidden = app.follow.active || !!sheetPoi || !app.started;
    el.northBtn.setAttribute('aria-pressed', String(app.follow.northLocked));
    el.northBtn.classList.toggle('is-heading', app.follow.headingUp);
    el.northMode.textContent = app.follow.headingUp ? str('headingUp') : 'N';
    renderDemo();
}

function renderNeedle() {
    el.needle.style.transform = `rotate(${-app.map.ml.getBearing()}deg)`;
}

// ---------------------------------------------------------------- demo

function renderDemo() {
    if (!ready) return;
    const simOn = app.source === 'sim' && app.sim.running;
    el.simToggleLabel.textContent = simOn ? t(lang, 'simPause') : t(lang, 'simulate');
    el.simToggle.querySelector('use')!.setAttribute('href', simOn ? '#i-pause' : '#i-sim-play');
    el.simToggle.setAttribute('aria-pressed', String(simOn));
    el.gpsBtn.setAttribute('aria-pressed', String(app.source === 'gps'));
    el.gpsBtn.querySelector('span')!.textContent = app.source === 'gps' ? str('gpsOn') : t(lang, 'useGps');
    document.querySelectorAll<HTMLInputElement>('input[name="profile"]').forEach((i) => (i.checked = i.value === app.sim.profile));
    document.querySelectorAll<HTMLInputElement>('input[name="scale"]').forEach((i) => (i.checked = Number(i.value) === app.sim.timeScale));
    el.readout.textContent = app.follow.active
        ? str('readout', {
              kmh: Math.round(app.follow.kmh),
              z: String(BANDS[app.follow.band].zoom).replace('.', lang === 'es' ? ',' : '.'),
              mode: app.follow.headingUp ? str('modeHeading') : str('modeNorth'),
          })
        : str('notFollowing');
}

function toggleDemo(open = el.demoPanel.hidden) {
    el.demoPanel.hidden = !open;
    el.demoBtn.setAttribute('aria-expanded', String(open));
    if (open) renderDemo();
}

// ---------------------------------------------------------------- modo bolsillo

function enterPocket() {
    if (el.settings.open) el.settings.close();
    toggleDemo(false);
    pocketOn = true;
    el.pocket.hidden = false;
    document.body.classList.add('pocket-on');
    renderPocket();
    el.pocket.focus();
}

function exitPocket() {
    pocketOn = false;
    el.pocket.hidden = true;
    document.body.classList.remove('pocket-on');
    renderBubble();
    el.pocketBtn.focus();
}

function renderPocket() {
    if (!pocketOn) return;
    el.pocketAlive.textContent = str('pocketAlive');
    const poi = narrating ?? cardPoi ?? lastAnnounced;
    el.pocketNow.textContent = poi ? displayTitle(poi) : '';
    el.pocketNow.classList.toggle('is-playing', !!narrating);
}

function wirePocket() {
    let last = 0;
    let lx = 0;
    let ly = 0;
    el.pocket.addEventListener('pointerup', (e) => {
        const now = performance.now();
        if (now - last < 420 && Math.hypot(e.clientX - lx, e.clientY - ly) < 60) {
            last = 0;
            exitPocket();
        } else {
            last = now;
            lx = e.clientX;
            ly = e.clientY;
        }
    });
    el.pocket.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') exitPocket();
    });
}

// ---------------------------------------------------------------- repintado general

function renderAll() {
    renderBubble();
    buildSheet();
    renderCard();
    renderPlayer();
    renderQueue();
    renderFollow();
    renderPocket();
}

// ---------------------------------------------------------------- MockUI

const ui: MockUI = {
    name: 'editorial',
    theme,
    bottomInset: () => stackHeight() + 12,
    onReady(a) {
        ready = true;
        (window as unknown as { app: MockApp }).app = a;
        document.body.dataset.theme = a.dark ? 'dark' : 'light';
        el.darkToggle.checked = a.dark;
        a.map.ml.on('move', placeBubble);
        a.map.ml.on('rotate', renderNeedle);
        el.startBtn.disabled = false;
        applyStrings();
    },
    onAnnounce(poi) {
        lastAnnounced = poi;
        showCard(poi);
    },
    onExit(poi) {
        if (cardPoi?.id !== poi.id) return;
        if (cardTimer) clearTimeout(cardTimer);
        cardTimer = setTimeout(() => {
            if (cardPoi?.id === poi.id && !app.guide.isInside(poi)) hideCard();
        }, CARD_LINGER_MS);
        el.cardTimer.style.setProperty('--linger', `${CARD_LINGER_MS}ms`);
        renderCard();
    },
    onQueue(q) {
        const grew = q.length > queue.length;
        queue = q;
        if (grew && narrating) chime();
        renderQueue();
    },
    onStates() {
        if (app.selected?.id !== bubblePoi?.id) bubblePoi = app.selected;
        renderBubble();
        refreshSheet();
    },
    onFix() {
        if (bubblePoi) renderBubble();
        if (sheetPoi) el.sheetWhere.textContent = whereText(sheetPoi);
        if (cardPoi) renderCard();
        if (!el.demoPanel.hidden) renderDemo();
    },
    onFollowChange: renderFollow,
    onNarration(poi, p) {
        const starting = poi && !narrating;
        narrating = poi;
        progress = p;
        if (starting) hideCard();
        renderPlayer();
        refreshSheet();
        renderPocket();
    },
    onError(message) {
        toast(message);
        if (!ready) el.startLabel.textContent = message;
    },
};

// ---------------------------------------------------------------- eventos

function wire() {
    el.startBtn.addEventListener('click', () => {
        if (!ready) return;
        try {
            audio = new AudioContext();
        } catch {
            audio = null;
        }
        app.start();
        el.start.classList.add('is-gone');
        el.start.addEventListener('transitionend', () => (el.start.hidden = true), { once: true });
        if (reducedMotion()) el.start.hidden = true;
        document.body.classList.add('started');
        renderStack();
        renderFollow();
        renderDemo();
    });

    document.querySelectorAll<HTMLInputElement>('input[name="lang"], input[name="lang-start"]').forEach((i) =>
        i.addEventListener('change', () => i.checked && setLang(i.value as Lang)),
    );

    el.bubble.addEventListener('click', () => bubblePoi && openSheet(bubblePoi, el.bubble));
    el.scrim.addEventListener('click', closeSheet);
    el.sheetClose.addEventListener('click', closeSheet);
    el.sheetListen.addEventListener('click', () => sheetPoi && app.narrate(sheetPoi));
    wireSheetDrag();
    el.sheetScroll.addEventListener('scroll', () => el.sheet.classList.toggle('is-scrolled', el.sheetScroll.scrollTop > 4), { passive: true });

    el.cardListen.addEventListener('click', () => cardPoi && app.narrate(cardPoi));
    const readCard = (e: Event) => cardPoi && openSheet(cardPoi, e.currentTarget as HTMLElement);
    el.cardRead.addEventListener('click', readCard);
    el.cardOpen.addEventListener('click', readCard);
    el.cardClose.addEventListener('click', () => {
        hideCard();
        el.settingsBtn.focus({ preventScroll: true });
    });

    el.playerToggle.addEventListener('click', () => (app.narrator.paused ? app.resume() : app.pause()));
    el.playerStop.addEventListener('click', () => app.stop());
    el.playerInfo.addEventListener('click', () => narrating && openSheet(narrating, el.playerInfo));

    el.recenter.addEventListener('click', () => app.follow.recenter());
    el.northBtn.addEventListener('click', () => app.follow.toggleNorth());

    el.settingsBtn.addEventListener('click', () => {
        toggleDemo(false);
        el.settings.showModal();
    });
    el.settingsClose.addEventListener('click', () => el.settings.close());
    el.settings.addEventListener('click', (e) => {
        if (e.target === el.settings) el.settings.close();
    });
    el.darkToggle.addEventListener('change', () => {
        app.setDark(el.darkToggle.checked);
        document.body.dataset.theme = el.darkToggle.checked ? 'dark' : 'light';
    });
    el.pocketEnter.addEventListener('click', enterPocket);
    el.pocketBtn.addEventListener('click', enterPocket);
    el.resetSession.addEventListener('click', () => {
        app.guide.resetSession();
        toast(str('sessionDone'));
    });
    el.resetHeard.addEventListener('click', () => {
        app.guide.resetHeard();
        toast(str('heardDone'));
    });
    wirePocket();

    el.demoBtn.addEventListener('click', () => toggleDemo());
    el.simToggle.addEventListener('click', () => {
        if (!app.started) return;
        app.toggleSim();
        renderDemo();
    });
    el.simRestart.addEventListener('click', () => {
        if (app.source !== 'sim') app.toggleSim();
        app.sim.restart();
        app.follow.recenter();
        renderDemo();
    });
    el.gpsBtn.addEventListener('click', () => {
        app.useGps();
        app.follow.recenter();
        renderDemo();
    });
    document.querySelectorAll<HTMLInputElement>('input[name="profile"]').forEach((i) =>
        i.addEventListener('change', () => i.checked && (app.setProfile(i.value as SpeedProfile), renderDemo())),
    );
    document.querySelectorAll<HTMLInputElement>('input[name="scale"]').forEach((i) =>
        i.addEventListener('change', () => i.checked && ((app.sim.timeScale = Number(i.value)), renderDemo())),
    );

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || pocketOn || el.settings.open) return;
        if (sheetPoi) closeSheet();
        else if (!el.demoPanel.hidden) {
            toggleDemo(false);
            el.demoBtn.focus();
        }
    });

    new ResizeObserver(() => renderStack()).observe(el.stack);
}

// ---------------------------------------------------------------- arranque

function paintLegend() {
    document.querySelectorAll<HTMLElement>('[data-icon]').forEach((slot) => {
        const state = slot.dataset.icon as PoiState;
        const img = ICONS[state];
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.width = `${img.width / 2}px`;
        canvas.style.height = `${img.height / 2}px`;
        canvas.getContext('2d')!.putImageData(img, 0, 0);
        slot.replaceChildren(canvas);
    });
}

app = new MockApp(ui);
lang = app.lang;
paintLegend();
wire();
applyStrings();
void app.boot('map');
