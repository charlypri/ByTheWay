// Mock C "Mínima": el mapa es la interfaz. Una sola píldora inferior cambia de forma
// entre reposo, Anuncio, Narración y ficha; el resto son botones pequeños sobre el mapa.
import './style.css';
import type { Lang, Poi } from '../../src/lib/kml';
import { MockApp, type MockUI } from '../shared/boot';
import { BANDS } from '../shared/follow';
import type { PoiState } from '../shared/guide';
import { drawIcon, type MapTheme } from '../shared/map';
import type { SpeedProfile } from '../shared/position';
import { splitSentences, type NarrationProgress } from '../shared/speech';
import { formatDistance, paragraphs, t, type StringKey } from '../shared/ui';

// ---------------------------------------------------------------------------
// Textos propios de este mock (los comunes están en shared/ui.ts)

const ES = {
    mapLabel: 'Mapa',
    tagline: 'Un guía que te avisa al pasar junto a cada lugar y te lo cuenta si quieres.',
    legendNew: 'Por descubrir',
    legendAnnounced: 'Anunciado',
    nearOne: '1 lugar cerca',
    nearMany: '{n} lugares cerca',
    nearNone: 'Nada nuevo cerca',
    walking: 'Paseando',
    biking: 'En bici',
    driving: 'En coche',
    still: 'Parado',
    locating: 'Buscando tu posición',
    sentence: 'Frase {i} de {n}',
    paused: 'En pausa, frase {i} de {n}',
    more: 'y {n} más',
    distance: 'a {d} de ti',
    dismiss: 'Descartar',
    listenAgain: 'Volver a escuchar',
    playingNow: 'Escuchando ahora',
    announced: 'Anunciado hoy',
    openPlace: 'Abrir {t}',
    pocketHint: 'Pantalla negra; la guía sigue avisando.',
    guideOn: 'La guía sigue contigo',
    sessionDone: 'Sesión reiniciada: los lugares se pueden volver a anunciar',
    heardDone: 'Escuchados borrados',
    gpsOn: 'Usando tu GPS',
    simOn: 'Paseo simulado',
    demo: 'Demo',
    demoTitle: 'Herramientas de demo',
    demoNote: 'Solo para probar el prototipo; no forman parte de la app.',
    restartWalk: 'Reiniciar',
    profile: 'Velocidad del paseo',
    clock: 'Reloj de la simulación',
    readout: '{k} km/h, zoom {z}',
    headingUp: 'rumbo arriba',
    northUp: 'norte arriba',
    compassFree: 'Girar con el rumbo',
};
const EN: Record<keyof typeof ES, string> = {
    mapLabel: 'Map',
    tagline: 'A guide that tells you when you pass each place, and its story if you ask.',
    legendNew: 'New',
    legendAnnounced: 'Announced',
    nearOne: '1 place nearby',
    nearMany: '{n} places nearby',
    nearNone: 'Nothing new nearby',
    walking: 'Walking',
    biking: 'Cycling',
    driving: 'Driving',
    still: 'Standing still',
    locating: 'Finding your position',
    sentence: 'Sentence {i} of {n}',
    paused: 'Paused, sentence {i} of {n}',
    more: 'and {n} more',
    distance: '{d} away',
    dismiss: 'Dismiss',
    listenAgain: 'Listen again',
    playingNow: 'Playing now',
    announced: 'Announced today',
    openPlace: 'Open {t}',
    pocketHint: 'Black screen; the guide keeps announcing.',
    guideOn: 'The guide is still with you',
    sessionDone: 'Session reset: places can be announced again',
    heardDone: 'Heard places cleared',
    gpsOn: 'Using your GPS',
    simOn: 'Simulated walk',
    demo: 'Demo',
    demoTitle: 'Demo tools',
    demoNote: 'Only for trying out the prototype; not part of the app.',
    restartWalk: 'Restart',
    profile: 'Walk speed',
    clock: 'Simulation clock',
    readout: '{k} km/h, zoom {z}',
    headingUp: 'heading up',
    northUp: 'north up',
    compassFree: 'Rotate with heading',
};
const LOCAL: Record<Lang, typeof EN> = { es: ES, en: EN };
type Key = StringKey | keyof typeof ES;

function s(key: Key, vars?: Record<string, string | number>): string {
    const lang = app.lang;
    const raw = key in ES ? LOCAL[lang][key as keyof typeof ES] : t(lang, key as StringKey);
    return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw;
}

// ---------------------------------------------------------------------------
// Tema del mapa: un solo acento (azul ultramar) y todo lo demás en grises.
// Los iconos son los mismos en claro y oscuro (el core no los cambia al alternar),
// así que llevan un aro blanco que se lee sobre ambos fondos.

const MAP_ACCENT = '#3A43E6';
const TAU = Math.PI * 2;

function disc(x: CanvasRenderingContext2D, c: number, r: number, fill: string, ring: string, ringW: number) {
    x.beginPath();
    x.arc(c, c, r + ringW / 2, 0, TAU);
    x.fillStyle = ring;
    x.fill();
    x.beginPath();
    x.arc(c, c, r - ringW / 2, 0, TAU);
    x.fillStyle = fill;
    x.fill();
}

const ICONS: Record<PoiState, ImageData> = {
    // Por descubrir: punto lleno de acento.
    pending: drawIcon(20, (x, s) => {
        x.shadowColor = 'rgba(0,0,0,.25)';
        x.shadowBlur = 2;
        disc(x, s / 2, 6.5, MAP_ACCENT, '#fff', 2.5);
    }),
    // Anunciado: aro hueco de acento; sigue invitando, pero ya pasó.
    announced: drawIcon(20, (x, s) => {
        x.shadowColor = 'rgba(0,0,0,.25)';
        x.shadowBlur = 2;
        disc(x, s / 2, 6.5, '#fff', '#fff', 2.5);
        x.shadowBlur = 0;
        x.beginPath();
        x.arc(s / 2, s / 2, 5.2, 0, TAU);
        x.lineWidth = 2.6;
        x.strokeStyle = MAP_ACCENT;
        x.stroke();
    }),
    // Escuchado: punto gris pequeño, se retira.
    heard: drawIcon(14, (x, s) => disc(x, s / 2, 4.2, '#8B919B', 'rgba(255,255,255,.9)', 1.6)),
    // Sonando: diana, el único marcador grande.
    playing: drawIcon(34, (x, s) => {
        const c = s / 2;
        x.beginPath();
        x.arc(c, c, 15, 0, TAU);
        x.fillStyle = 'rgba(58,67,230,.16)';
        x.fill();
        x.lineWidth = 2;
        x.strokeStyle = MAP_ACCENT;
        x.stroke();
        disc(x, c, 7, MAP_ACCENT, '#fff', 2.5);
    }),
};

const PUCK = drawIcon(30, (x, s) => {
    const c = s / 2;
    // Disco de tinta con aro blanco y un chevrón blanco que marca el rumbo (el core lo gira).
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = 4;
    disc(x, c, 9, '#14161B', '#fff', 3);
    x.shadowBlur = 0;
    x.beginPath();
    x.moveTo(c, c - 4.6);
    x.lineTo(c + 3.6, c + 3.4);
    x.lineTo(c, c + 1.6);
    x.lineTo(c - 3.6, c + 3.4);
    x.closePath();
    x.fillStyle = '#fff';
    x.fill();
});

function theme(dark: boolean): MapTheme {
    return {
        icons: ICONS,
        puck: PUCK,
        label: dark ? { color: '#D9DCE1', halo: '#1C1E23', size: 12 } : { color: '#3A3E46', halo: '#FFFFFF', size: 12 },
        radius: dark ? { fill: 'rgba(139,145,255,.10)', line: 'rgba(139,145,255,.75)' } : { fill: 'rgba(58,67,230,.07)', line: 'rgba(58,67,230,.6)' },
        cluster: dark ? { fill: '#EDEEF1', text: '#14161B', stroke: '#1C1E23' } : { fill: '#14161B', text: '#FFFFFF', stroke: '#FFFFFF' },
        accuracy: dark ? 'rgba(255,255,255,.07)' : 'rgba(20,22,27,.07)',
    };
}

// ---------------------------------------------------------------------------
// DOM

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const html = document.documentElement;
const pill = $('pill');
const dock = $('dock');
const nextTab = $<HTMLButtonElement>('next');
const views = {
    idle: pill.querySelector<HTMLElement>('[data-view="idle"]')!,
    announce: pill.querySelector<HTMLElement>('[data-view="announce"]')!,
    narration: pill.querySelector<HTMLElement>('[data-view="narration"]')!,
    sheet: pill.querySelector<HTMLElement>('[data-view="sheet"]')!,
};
type Mode = keyof typeof views;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------------------
// Estado de la interfaz

let card: Poi | null = null;
let cardTimer: ReturnType<typeof setTimeout> | undefined;
let sheetPoi: Poi | null = null;
let narr: { poi: Poi; p: NarrationProgress } | null = null;
let queue: Poi[] = [];
let lastSelected: Poi | null = null;
let mode: Mode = 'idle';
let pillH = 56;
let pocketOn = false;
let audio: AudioContext | null = null;
let sheetReturnFocus: HTMLElement | null = null;

const CARD_AFTER_EXIT_MS = 30_000;
const NEAR_M = 200;

// ---------------------------------------------------------------------------
// Arranque

const ui: MockUI = {
    name: 'minima',
    theme,
    bottomInset: () => pillH + dockBottom() + 20,
    onReady() {
        $<HTMLButtonElement>('start-btn').disabled = false;
        app.map.ml.on('move', placeBubble);
        app.map.ml.on('rotate', renderCompass);
        renderAll();
    },
    onAnnounce(poi) {
        clearTimeout(cardTimer);
        card = poi;
        $('sr-live').textContent = app.text(poi).title;
        renderAll();
    },
    onExit(poi) {
        if (card?.id === poi.id) {
            clearTimeout(cardTimer);
            cardTimer = setTimeout(() => {
                if (card?.id === poi.id && !app.guide.isInside(poi)) dismissCard();
            }, CARD_AFTER_EXIT_MS);
        }
        renderAll();
    },
    onQueue(q) {
        if (q.length > queue.length && app.narrating) chime();
        queue = q;
        renderNext();
        renderPocket();
    },
    onStates() {
        if (app.selected !== lastSelected) {
            lastSelected = app.selected;
            // Tocar otro POI o el fondo del mapa cierra la ficha abierta.
            if (sheetPoi && app.selected?.id !== sheetPoi.id) sheetPoi = null;
        }
        renderAll();
    },
    onFix() {
        renderIdle();
        renderCardMeta();
        if (sheetPoi) renderSheetMeta();
        renderBubble();
        renderDemo();
    },
    onFollowChange() {
        renderFollow();
        renderDemo();
    },
    onNarration(poi, progress) {
        narr = poi && progress ? { poi, p: progress } : null;
        renderAll();
    },
    onError(message) {
        if (!app.started) {
            const el = $('start-error');
            el.hidden = false;
            el.textContent = message;
        }
        toast(message);
    },
};

const app = new MockApp(ui);
(window as unknown as { app: MockApp }).app = app;

applyTheme();
applyStrings();
void app.boot('map');

// ---------------------------------------------------------------------------
// Píldora: medir la vista activa y animar el contenedor hacia su tamaño

function currentMode(): Mode {
    if (sheetPoi) return 'sheet';
    if (narr) return 'narration';
    if (card) return 'announce';
    return 'idle';
}

function setMode(next: Mode) {
    const prev = mode;
    mode = next;
    pill.dataset.mode = next;
    for (const [name, el] of Object.entries(views) as [Mode, HTMLElement][]) {
        const on = name === next;
        el.classList.toggle('active', on);
        el.inert = !on;
    }
    syncRecenter();
    layout();
    if (prev !== next) {
        if (next === 'sheet') {
            requestAnimationFrame(() => $('sheet-title').focus({ preventScroll: true }));
        } else if (prev === 'sheet' && pill.contains(document.activeElement) === false) {
            sheetReturnFocus?.focus({ preventScroll: true });
        }
    }
}

function layout() {
    const v = views[mode];
    const w = v.offsetWidth;
    const h = v.offsetHeight;
    pillH = h;
    pill.style.width = `${w}px`;
    pill.style.height = `${h}px`;
    nextTab.style.width = `${Math.max(w - 40, 200)}px`;
    $('recenter').style.bottom = `${h + dockBottom() + (nextTab.classList.contains('show') ? 40 : 12)}px`;
}

const ro = new ResizeObserver(() => layout());
Object.values(views).forEach((v) => ro.observe(v));

function dockBottom() {
    return parseFloat(getComputedStyle(dock).bottom) || 12;
}

// ---------------------------------------------------------------------------
// Render

function renderAll() {
    if (!app.guide) return;
    renderIdle();
    renderCard();
    renderNarration();
    renderSheet();
    renderNext();
    renderBubble();
    renderFollow();
    renderPocket();
    renderDemo();
    setMode(currentMode());
}

function renderIdle() {
    if (!app.guide) return;
    const main = $('idle-main');
    const sub = $('idle-sub');
    if (!app.fix) {
        main.textContent = s('locating');
        sub.textContent = '';
        sub.hidden = true;
        return;
    }
    const near = app.pois.filter((p) => app.guide.stateOf(p) === 'pending' && (app.distanceTo(p) ?? Infinity) <= NEAR_M).length;
    main.textContent = near === 0 ? s('nearNone') : near === 1 ? s('nearOne') : s('nearMany', { n: near });
    const kmh = app.follow.kmh;
    const band = BANDS[app.follow.band].name;
    sub.hidden = false;
    const stopped = kmh < 1 || (app.source === 'sim' && !app.sim.running);
    sub.textContent = stopped ? s('still') : band === 'walk' ? s('walking') : band === 'bike' ? s('biking') : s('driving');
}

function distanceText(poi: Poi) {
    if (app.guide.isInside(poi)) return t(app.lang, 'nearYou');
    const d = app.distanceTo(poi);
    return d == null ? '' : s('distance', { d: formatDistance(d, app.lang) });
}

function badge(poi: Poi) {
    return app.text(poi).lang !== app.lang ? `<span class="badge" lang="${app.lang}">${esc(t(app.lang, 'onlyInSpanish'))}</span>` : '';
}

function renderCard() {
    if (!card) return;
    const tx = app.text(card);
    const title = $('ann-title');
    title.textContent = tx.title;
    title.lang = tx.lang;
    $('ann-open').setAttribute('aria-label', s('openPlace', { t: tx.title }));
    renderCardMeta();
}

function renderCardMeta() {
    if (!card) return;
    $('ann-meta').innerHTML = `<span>${esc(distanceText(card))}</span>${badge(card)}`;
}

function renderNarration() {
    if (!narr) return;
    const tx = app.text(narr.poi);
    const title = $('narr-title');
    title.textContent = tx.title;
    title.lang = tx.lang;
    const { index, total } = narr.p;
    const paused = app.narrator.paused;
    const i = Math.min(index + 1, total);
    $('narr-sub').textContent = s(paused ? 'paused' : 'sentence', { i, n: total });
    $('ring-fg').style.strokeDashoffset = String(100 - (total ? (i / total) * 100 : 0));
    $('narr-icon-pause').toggleAttribute('hidden', paused);
    $('narr-icon-play').toggleAttribute('hidden', !paused);
    $('narr-toggle').setAttribute('aria-label', t(app.lang, paused ? 'resume' : 'pause'));
    $('narr-open').setAttribute('aria-label', s('openPlace', { t: tx.title }));
    pill.classList.toggle('is-paused', paused);
}

let sheetRenderedFor = '';
function renderSheet() {
    if (!sheetPoi) {
        sheetRenderedFor = '';
        return;
    }
    const poi = sheetPoi;
    const tx = app.text(poi);
    const title = $('sheet-title');
    title.textContent = tx.title;
    title.lang = tx.lang;

    const body = $('sheet-body');
    const key = `${poi.id}|${app.lang}`;
    if (key !== sheetRenderedFor) {
        sheetRenderedFor = key;
        body.lang = tx.lang;
        const paras = paragraphs(tx.description);
        body.innerHTML = paras.length
            ? paras.map((p) => `<p>${esc(p)}</p>`).join('')
            : `<p class="empty">${esc(t(app.lang, 'noDescription'))}</p>`;
        body.scrollTop = 0;
    }
    renderSheetMeta();

    const playing = narr?.poi.id === poi.id;
    const state = app.guide.stateOf(poi);
    $('sheet-listen').hidden = playing;
    $('sheet-playing').hidden = !playing;
    $('sheet-listen-label').textContent = state === 'heard' ? s('listenAgain') : t(app.lang, 'listen');
    ($('sheet-listen') as HTMLButtonElement).disabled = !tx.description.trim();
    if (playing) {
        const paused = app.narrator.paused;
        $('sheet-toggle').innerHTML = paused
            ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.6v12.8a1 1 0 0 0 1.5.85l10-6.4a1 1 0 0 0 0-1.7l-10-6.4a1 1 0 0 0-1.5.85z" fill="currentColor"/></svg><span>${esc(t(app.lang, 'resume'))}</span>`
            : `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/></svg><span>${esc(t(app.lang, 'pause'))}</span>`;
    }
    markCurrentParagraph();
}

/** Marca el párrafo que se está leyendo; la frase 0 es el título. */
function markCurrentParagraph() {
    const body = $('sheet-body');
    const ps = Array.from(body.querySelectorAll('p'));
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
    const stateText = state === 'playing' ? s('playingNow') : state === 'heard' ? t(app.lang, 'heard') : state === 'announced' ? s('announced') : '';
    const parts = [
        `<span>${esc(distanceText(sheetPoi))}</span>`,
        stateText ? `<span class="state"><i class="glyph" data-state="${state}"></i>${esc(stateText)}</span>` : '',
        badge(sheetPoi),
    ];
    $('sheet-meta').innerHTML = parts.filter(Boolean).join('');
}

function renderNext() {
    const show = queue.length > 0 && mode !== 'sheet';
    nextTab.classList.toggle('show', show);
    nextTab.setAttribute('aria-hidden', String(!show));
    nextTab.tabIndex = show ? 0 : -1;
    if (queue.length) {
        const tx = app.text(queue[0]);
        $('next-title').textContent = tx.title;
        $('next-title').lang = tx.lang;
        $('next-more').textContent = queue.length > 1 ? s('more', { n: queue.length - 1 }) : '';
    }
    layout();
}

function renderBubble() {
    const anchor = $('bubble-anchor');
    const poi = app.selected;
    if (!poi || sheetPoi?.id === poi.id) {
        anchor.hidden = true;
        return;
    }
    anchor.hidden = false;
    const tx = app.text(poi);
    $('bubble-title').textContent = tx.title;
    $('bubble-title').lang = tx.lang;
    const state = app.guide.stateOf(poi);
    const extra = state === 'heard' ? t(app.lang, 'heard') : '';
    $('bubble-meta').textContent = [distanceText(poi), extra].filter(Boolean).join(', ');
    $('bubble').setAttribute('aria-label', s('openPlace', { t: tx.title }));
    placeBubble();
}

function placeBubble() {
    const poi = app.selected;
    const anchor = $('bubble-anchor');
    if (!poi || anchor.hidden) return;
    const pt = app.map.ml.project([poi.lon, poi.lat]);
    anchor.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
}

function renderFollow() {
    if (!app.follow) return;
    syncRecenter();
    const north = $('north-btn');
    north.setAttribute('aria-pressed', String(app.follow.northLocked));
    north.setAttribute('aria-label', app.follow.northLocked ? t(app.lang, 'north') : s('compassFree'));
    north.title = app.follow.northLocked ? t(app.lang, 'north') : s('compassFree');
    renderCompass();
    layout();
}

/** Recentrar solo tiene sentido fuera del seguimiento, y no compite con la ficha abierta. */
function syncRecenter() {
    $('recenter').hidden = !app.follow || app.follow.active || mode === 'sheet';
}

function renderCompass() {
    const b = app.map?.ml.getBearing() ?? 0;
    $('needle').setAttribute('transform', `rotate(${-b} 12 12)`);
}

function renderPocket() {
    if (!pocketOn) return;
    const st = $('pocket-status');
    if (narr) {
        st.innerHTML = `<span class="pocket-dot"></span>${esc(app.text(narr.poi).title)}`;
    } else if (card) {
        st.innerHTML = `<span class="pocket-dot hollow"></span>${esc(app.text(card).title)}`;
    } else {
        st.textContent = s('guideOn');
    }
}

function renderDemo() {
    if (!app.guide) return;
    const simRunning = app.source === 'sim' && app.sim.running;
    $('sim-toggle').textContent = simRunning ? t(app.lang, 'simPause') : t(app.lang, 'simulate');
    document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.profile === app.sim.profile)));
    document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === app.sim.timeScale)));
    $('gps-btn').setAttribute('aria-pressed', String(app.source === 'gps'));
    const f = app.follow;
    $('demo-readout').textContent = f
        ? `${app.source === 'gps' ? s('gpsOn') : s('simOn')}. ${s('readout', { k: Math.round(f.kmh), z: BANDS[f.band].zoom })}, ${f.headingUp ? s('headingUp') : s('northUp')}.`
        : '';
}

// ---------------------------------------------------------------------------
// Acciones

function openSheet(poi: Poi) {
    if (!pill.contains(document.activeElement)) sheetReturnFocus = document.activeElement as HTMLElement | null;
    else sheetReturnFocus = null;
    sheetPoi = poi;
    if (app.selected?.id !== poi.id) app.select(poi);
    else renderAll();
    // Siguiendo al usuario la cámara ya lo encuadra sobre la ficha; si no, se centra el POI.
    if (!app.follow.active) app.map.flyToPoi(poi, pillH + dockBottom() + 16);
}

function closeSheet() {
    sheetPoi = null;
    app.select(null);
    if (sheetReturnFocus === null) requestAnimationFrame(() => focusPillPrimary());
}

function focusPillPrimary() {
    const target = mode === 'narration' ? $('narr-toggle') : mode === 'announce' ? $('ann-listen') : null;
    target?.focus({ preventScroll: true });
}

function listen(poi: Poi) {
    if (card?.id === poi.id) dismissCard(false);
    app.narrate(poi);
}

function dismissCard(render = true) {
    clearTimeout(cardTimer);
    card = null;
    if (render) renderAll();
}

function togglePause() {
    if (app.narrator.paused) app.resume();
    else app.pause();
}

function setLang(lang: Lang) {
    app.setLang(lang);
    sheetRenderedFor = '';
    applyStrings();
    renderAll();
}

function applyStrings() {
    html.lang = app.lang;
    document.querySelectorAll<HTMLElement>('[data-s]').forEach((el) => (el.textContent = s(el.dataset.s as Key)));
    document.querySelectorAll<HTMLElement>('[data-s-aria]').forEach((el) => el.setAttribute('aria-label', s(el.dataset.sAria as Key)));
    document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === app.lang)));
    $('recenter').setAttribute('aria-label', t(app.lang, 'recenter'));
}

function applyTheme() {
    html.dataset.theme = app.dark ? 'dark' : 'light';
    $('dark-switch').setAttribute('aria-checked', String(app.dark));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', app.dark ? '#16181c' : '#eceef1');
}

function enterPocket() {
    closePanels();
    pocketOn = true;
    const el = $('pocket');
    el.hidden = false;
    renderPocket();
    el.focus();
}

function exitPocket() {
    pocketOn = false;
    $('pocket').hidden = true;
}

function chime() {
    if (!audio) return;
    const now = audio.currentTime;
    const tone = (freq: number, at: number) => {
        const o = audio!.createOscillator();
        const g = audio!.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now + at);
        g.gain.exponentialRampToValueAtTime(0.07, now + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6);
        o.connect(g).connect(audio!.destination);
        o.start(now + at);
        o.stop(now + at + 0.65);
    };
    tone(880, 0);
    tone(1318.5, 0.12);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function esc(v: string) {
    return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Paneles (ajustes y demo)
function togglePanel(id: 'settings' | 'demo') {
    const panel = $(id);
    const open = panel.hidden;
    closePanels();
    if (open) {
        panel.hidden = false;
        $(id === 'settings' ? 'settings-btn' : 'demo-btn').setAttribute('aria-expanded', 'true');
        renderDemo();
        panel.querySelector<HTMLElement>('button')?.focus();
    }
}

function closePanels(returnFocus = false) {
    for (const id of ['settings', 'demo'] as const) {
        const panel = $(id);
        const btn = $(id === 'settings' ? 'settings-btn' : 'demo-btn');
        if (!panel.hidden && returnFocus) btn.focus();
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
    }
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
    const start = $('start');
    start.classList.add('leaving');
    setTimeout(() => (start.hidden = true), reduceMotion.matches ? 0 : 320);
    renderAll();
});

document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));

$('ann-listen').addEventListener('click', () => card && listen(card));
$('ann-open').addEventListener('click', () => card && openSheet(card));
$('ann-close').addEventListener('click', () => dismissCard());
$('narr-toggle').addEventListener('click', togglePause);
$('narr-stop').addEventListener('click', () => app.stop());
$('narr-open').addEventListener('click', () => narr && openSheet(narr.poi));
$('sheet-close').addEventListener('click', closeSheet);
$('sheet-listen').addEventListener('click', () => sheetPoi && listen(sheetPoi));
$('sheet-toggle').addEventListener('click', togglePause);
$('sheet-stop').addEventListener('click', () => app.stop());
$('bubble').addEventListener('click', () => app.selected && openSheet(app.selected));
nextTab.addEventListener('click', () => queue[0] && openSheet(queue[0]));

$('recenter').addEventListener('click', () => app.follow.recenter());
$('north-btn').addEventListener('click', () => app.follow.toggleNorth());
$('settings-btn').addEventListener('click', () => togglePanel('settings'));
$('demo-btn').addEventListener('click', () => togglePanel('demo'));
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((b) => b.addEventListener('click', () => closePanels(true)));

$('dark-switch').addEventListener('click', () => {
    app.setDark(!app.dark);
    applyTheme();
});
$('pocket-btn').addEventListener('click', enterPocket);
$('reset-session').addEventListener('click', () => {
    app.guide.resetSession();
    toast(s('sessionDone'));
});
$('reset-heard').addEventListener('click', () => {
    app.guide.resetHeard();
    toast(s('heardDone'));
});

$('sim-toggle').addEventListener('click', () => {
    app.toggleSim();
    renderAll();
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
$('gps-btn').addEventListener('click', () => {
    app.useGps();
    app.follow.recenter();
    toast(s('gpsOn'));
    renderDemo();
});

// Modo bolsillo: doble toque para salir (y Escape con teclado).
const pocket = $('pocket');
pocket.tabIndex = -1;
let lastTap = 0;
pocket.addEventListener('pointerup', (e) => {
    if (e.timeStamp - lastTap < 400) {
        lastTap = 0;
        exitPocket();
    } else lastTap = e.timeStamp;
});
pocket.addEventListener('dblclick', exitPocket);

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pocketOn) return exitPocket();
    if (!$('settings').hidden || !$('demo').hidden) return closePanels(true);
    if (sheetPoi) return closeSheet();
});

document.addEventListener('pointerdown', (e) => {
    const target = e.target as Node;
    for (const id of ['settings', 'demo'] as const) {
        const panel = $(id);
        const btn = $(id === 'settings' ? 'settings-btn' : 'demo-btn');
        if (!panel.hidden && !panel.contains(target) && !btn.contains(target)) closePanels();
    }
});

addEventListener('resize', layout);
