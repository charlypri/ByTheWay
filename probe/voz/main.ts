// Prueba de voz (issue #2): ¿vale la Web Speech API de este móvil para Bytheway?
import { parseKml, type Lang } from '../../src/lib/kml';
import { bestVoice, splitSentences, voicesReady } from '../../mocks/shared/speech';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const EN_SAMPLE = {
    title: 'The Fallen Angel',
    description: `Made by Ricardo Bellver in 1877.

It centres on the figure of Lucifer as described in John Milton's poem "Paradise Lost".

After travelling to the 1878 Paris World's Fair, it was given a permanent home in the Retiro park.

The present ensemble, a fountain and a pedestal with a bronze devil holding different animals on each of its eight sides, was unveiled in 1885.

By the way, this spot stands exactly 666 metres above sea level.`,
};

const results: Record<string, string> = {};
const texts: Record<'announce' | 'long', { title: string; description: string }> = {
    announce: { title: 'Escultura del Ángel Caído', description: '' },
    long: { title: 'Ruinas de la Ermita de San Pelayo y San Isidoro', description: '' },
};
let voices: SpeechSynthesisVoice[] = [];
const chosen: Partial<Record<Lang, SpeechSynthesisVoice>> = {};

const supported = 'speechSynthesis' in window;

async function init() {
    $('device').textContent = navigator.userAgent;
    if (!supported) {
        $('voice-summary').textContent = 'Este navegador no tiene síntesis de voz. Bytheway necesitaría audios pregenerados.';
        $('voice-summary').className = 'result warn';
        results.soporte = 'sin speechSynthesis';
        document.querySelectorAll<HTMLButtonElement>('.step:not(#step-report) button').forEach((b) => (b.disabled = true));
        renderReport();
        return;
    }
    await loadTexts();
    voices = await voicesReady();
    fillPicker('es');
    fillPicker('en');
    summariseVoices();
    wire();
    renderReport();
}

async function loadTexts() {
    try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/spain.es.kml`);
        const pois = parseKml(await res.text());
        for (const key of Object.keys(texts) as (keyof typeof texts)[]) {
            const poi = pois.find((p) => p.title === texts[key].title);
            if (poi) texts[key] = { title: poi.title, description: poi.description };
        }
    } catch {
        texts.long.description = 'No se pudo cargar el texto del dataset. Comprueba la conexión y recarga la página.';
    }
}

function fillPicker(lang: Lang) {
    const select = $<HTMLSelectElement>(`voice-${lang}`);
    const prefix = lang === 'es' ? 'es' : 'en';
    const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    const best = bestVoice(voices, lang);
    select.replaceChildren(
        ...candidates.map((v) => {
            const o = new Option(`${v.name} (${v.lang}${v.localService ? '' : ', en red'})`, v.voiceURI);
            o.selected = v === best;
            return o;
        }),
    );
    if (!candidates.length) select.add(new Option('No hay voces para este idioma', ''));
    chosen[lang] = best;
    select.onchange = () => {
        chosen[lang] = voices.find((v) => v.voiceURI === select.value);
        renderReport();
    };
}

function summariseVoices() {
    const es = voices.filter((v) => v.lang.toLowerCase().startsWith('es')).length;
    const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en')).length;
    const el = $('voice-summary');
    el.textContent = `${voices.length} voces en total: ${es} en castellano y ${en} en inglés.`;
    el.className = es && en ? 'result ok' : 'result warn';
    if (es) $('step-voices').classList.add('done');
}

function utter(text: string, lang: Lang) {
    const u = new SpeechSynthesisUtterance(text);
    const v = chosen[lang];
    if (v) u.voice = v;
    u.lang = v?.lang ?? (lang === 'es' ? 'es-ES' : 'en-GB');
    return u;
}

// ---- Narración frase a frase -------------------------------------------------------------

let run = 0;
let sentences: string[] = [];
let index = 0;
let narrLang: Lang = 'es';
let paused = false;
/** Marca de tiempo de cada frase que empieza, para la prueba de pantalla apagada. */
const sentenceStarts: number[] = [];

function narrate(lang: Lang, title: string, description: string) {
    speechSynthesis.cancel();
    narrLang = lang;
    sentences = [title + '.', ...splitSentences(description)];
    index = 0;
    paused = false;
    sentenceStarts.length = 0;
    $('player').hidden = false;
    $('player-title').textContent = title;
    $('player-toggle').textContent = 'Pausar';
    playFrom(0);
}

function playFrom(i: number) {
    const token = ++run;
    const step = (j: number) => {
        if (token !== run) return;
        if (j >= sentences.length) {
            $('player-sentence').textContent = 'Fin de la narración.';
            $('player-bar').style.width = '100%';
            $('step-narration').classList.add('done');
            return;
        }
        index = j;
        $('player-sentence').textContent = sentences[j];
        $('player-bar').style.width = `${(j / sentences.length) * 100}%`;
        const u = utter(sentences[j], narrLang);
        u.onstart = () => sentenceStarts.push(Date.now());
        u.onend = () => step(j + 1);
        u.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') step(j + 1);
        };
        speechSynthesis.speak(u);
    };
    step(i);
}

function togglePause() {
    if (paused) {
        paused = false;
        $('player-toggle').textContent = 'Pausar';
        playFrom(index);
    } else {
        paused = true;
        run++;
        speechSynthesis.cancel();
        $('player-toggle').textContent = 'Seguir';
    }
}

function stopNarration() {
    run++;
    speechSynthesis.cancel();
    $('player').hidden = true;
}

// ---- Pruebas ---------------------------------------------------------------------------

function cutoffTest() {
    stopNarration();
    const text = `${texts.long.title}. ${texts.long.description.replace(/\s+/g, ' ')}`;
    const words = text.split(' ').length;
    const expected = words / 2.6; // ~155 palabras por minuto
    const out = $('cutoff-result');
    out.className = 'result';
    out.textContent = `Leyendo ${words} palabras. Deberían ser unos ${Math.round(expected)} s…`;
    const started = Date.now();
    const u = utter(text, 'es');
    const finish = (error?: string) => {
        const secs = (Date.now() - started) / 1000;
        const cut = secs < expected * 0.6;
        results.locucion_larga = `${secs.toFixed(1)} s de ~${Math.round(expected)} s${error ? ` (${error})` : ''}${cut ? ' → probablemente cortada' : ''}`;
        out.textContent = cut
            ? `Terminó a los ${secs.toFixed(1)} s, mucho antes de lo esperado: el navegador corta las locuciones largas. Por eso la app parte el texto en frases.`
            : `Duró ${secs.toFixed(1)} s, lo esperado. Este navegador no corta las locuciones largas.`;
        out.className = cut ? 'result warn' : 'result ok';
        $('step-cutoff').classList.add('done');
        renderReport();
    };
    u.onend = () => finish();
    u.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') finish(e.error);
    };
    speechSynthesis.speak(u);
}

function nativePauseTest() {
    stopNarration();
    speechSynthesis.cancel();
    const out = $('native-pause-result');
    const u = utter(`${texts.long.title}. ${splitSentences(texts.long.description).slice(0, 4).join(' ')}`, 'es');
    let ended = false;
    u.onend = () => (ended = true);
    speechSynthesis.speak(u);
    out.className = 'result';
    out.textContent = 'Escuchando… pausaremos a los 4 segundos.';
    setTimeout(() => {
        speechSynthesis.pause();
        out.textContent = 'Pausado. Reanudamos en 2 segundos…';
        setTimeout(() => {
            const state = `speaking=${speechSynthesis.speaking}, paused=${speechSynthesis.paused}, terminada=${ended}`;
            speechSynthesis.resume();
            results.pausa_nativa_estado = state;
            out.textContent = `Reanudado. Estado al reanudar: ${state}. Indica abajo qué has oído.`;
            renderReport();
        }, 2000);
    }, 4000);
}

function screenOffTest() {
    const out = $('screen-result');
    out.className = 'result';
    out.textContent = 'Narración en marcha. Bloquea el móvil ahora y vuelve en unos 20 segundos.';
    narrate('es', texts.long.title, texts.long.description);
    let hiddenAt = 0;
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') {
            hiddenAt = Date.now();
            return;
        }
        if (!hiddenAt) return;
        const backAt = Date.now();
        const during = sentenceStarts.filter((t) => t > hiddenAt + 500 && t < backAt).length;
        const secs = Math.round((backAt - hiddenAt) / 1000);
        const kept = during > 0;
        results.pantalla_apagada = `${secs} s oculta, ${during} frases empezaron mientras tanto → ${kept ? 'siguió' : 'se paró'}; al volver speaking=${speechSynthesis.speaking}`;
        out.textContent = kept
            ? `La voz siguió con la pantalla apagada: empezaron ${during} frases en ${secs} s.`
            : `La voz se paró con la pantalla apagada (${secs} s sin frases nuevas). Es lo esperado en una PWA (ADR 0002).`;
        out.className = kept ? 'result ok' : 'result warn';
        $('step-screen').classList.add('done');
        document.removeEventListener('visibilitychange', onVisibility);
        renderReport();
    };
    document.addEventListener('visibilitychange', onVisibility);
}

// ---- Informe ---------------------------------------------------------------------------

function renderReport() {
    const lines = [
        'Bytheway · prueba de voz',
        `Fecha: ${new Date().toISOString()}`,
        `Navegador: ${navigator.userAgent}`,
        `Modo: ${matchMedia('(display-mode: standalone)').matches ? 'PWA instalada' : 'navegador'}`,
        `Voces: ${voices.length} (es: ${voices.filter((v) => v.lang.startsWith('es')).length}, en: ${voices.filter((v) => v.lang.startsWith('en')).length})`,
        `Voz es: ${chosen.es ? `${chosen.es.name} [${chosen.es.lang}]${chosen.es.localService ? ' local' : ' red'}` : '—'}`,
        `Voz en: ${chosen.en ? `${chosen.en.name} [${chosen.en.lang}]${chosen.en.localService ? ' local' : ' red'}` : '—'}`,
        ...Object.entries(results).map(([k, v]) => `${k}: ${v}`),
    ];
    $<HTMLTextAreaElement>('report').value = lines.join('\n');
}

function wire() {
    document.querySelectorAll<HTMLButtonElement>('[data-say]').forEach((b) => {
        b.onclick = () => {
            stopNarration();
            const en = b.dataset.say === 'announce-en';
            speechSynthesis.speak(utter(en ? EN_SAMPLE.title : texts.announce.title, en ? 'en' : 'es'));
            $('step-announce').classList.add('done');
        };
    });
    $('narrate-es').onclick = () => narrate('es', texts.long.title, texts.long.description);
    $('narrate-en').onclick = () => narrate('en', EN_SAMPLE.title, EN_SAMPLE.description);
    $('player-toggle').onclick = togglePause;
    $('player-stop').onclick = stopNarration;
    $('cutoff').onclick = cutoffTest;
    $('cutoff-stop').onclick = () => speechSynthesis.cancel();
    $('native-pause').onclick = nativePauseTest;
    $('screen').onclick = screenOffTest;

    document.querySelectorAll<HTMLFieldSetElement>('.rate').forEach((set) => {
        set.querySelectorAll('button').forEach((b) => {
            b.onclick = () => {
                set.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
                results[set.dataset.key!] = b.value;
                renderReport();
            };
        });
    });

    $('copy').onclick = async () => {
        renderReport();
        try {
            await navigator.clipboard.writeText($<HTMLTextAreaElement>('report').value);
            $('copy-result').textContent = 'Informe copiado.';
        } catch {
            $<HTMLTextAreaElement>('report').select();
            $('copy-result').textContent = 'Selecciona el texto y cópialo a mano.';
        }
    };
    if ('share' in navigator) {
        $('share').hidden = false;
        $('share').onclick = () => void navigator.share({ title: 'Bytheway · prueba de voz', text: $<HTMLTextAreaElement>('report').value }).catch(() => {});
    }
}

void init();
