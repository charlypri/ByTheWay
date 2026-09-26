import { beforeEach, describe, expect, it, vi } from 'vitest';
import { narrationSentences, splitSentences, WebSpeechNarrator, type SpeechSynthesisLike } from './narrator';
import { memoryStore, type KeyValueStore } from './storage';

interface FakeUtterance {
    text: string;
    voice: SpeechSynthesisVoice | null;
    lang: string;
    volume: number;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
}

const voice = (name: string, lang: string, localService = true) => ({ name, lang, voiceURI: `${name}-${lang}`, localService, default: false }) as SpeechSynthesisVoice;

/**
 * Sintetizador falso. `safari` imita a Safari, que avisa con `end` (y no con `error`)
 * a las locuciones canceladas.
 */
function fakeSynth(voices: SpeechSynthesisVoice[] = [], safari = false) {
    const spoken: FakeUtterance[] = [];
    let queue: FakeUtterance[] = [];
    let onVoices: () => void = () => {};
    const synth: SpeechSynthesisLike & { spoken: FakeUtterance[]; finish(): void; loadVoices(v: SpeechSynthesisVoice[]): void } = {
        spoken,
        speak(u) {
            const f = u as unknown as FakeUtterance;
            spoken.push(f);
            queue.push(f);
        },
        cancel() {
            const cut = queue;
            queue = [];
            cut.forEach((u) => (safari ? u.onend?.() : u.onerror?.({ error: 'interrupted' })));
        },
        getVoices: () => voices,
        addEventListener: (_type, fn) => (onVoices = fn),
        finish() {
            queue.shift()?.onend?.();
        },
        loadVoices(v) {
            voices = v;
            onVoices();
        },
    };
    return synth;
}

const utterance = (text: string) => ({ text, voice: null, lang: '', volume: 1, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance;

let store: KeyValueStore;
beforeEach(() => {
    store = memoryStore();
});

function narrator(synth = fakeSynth()) {
    const n = new WebSpeechNarrator({ synth, utterance, store });
    const progress: number[] = [];
    const end = vi.fn();
    n.on('progress', (p) => progress.push(p.index));
    n.on('end', end);
    return { n, synth, progress, end };
}

const DESC = 'Primera frase. ¿Segunda?\n\nPor cierto, la tercera… y «la cuarta».';

describe('splitSentences', () => {
    it('parte por frases y párrafos, y conserva comillas de cierre y puntos suspensivos', () => {
        expect(splitSentences(DESC)).toEqual(['Primera frase.', '¿Segunda?', 'Por cierto, la tercera…', 'y «la cuarta».']);
    });

    it('acepta texto sin puntuación final y descripciones vacías', () => {
        expect(splitSentences('Sin punto final')).toEqual(['Sin punto final']);
        expect(splitSentences('   ')).toEqual([]);
    });

    it('la Narración empieza por el título', () => {
        expect(narrationSentences('Estanque', 'Grande.')).toEqual(['Estanque.', 'Grande.']);
        expect(narrationSentences('¿Qué es?', '')).toEqual(['¿Qué es?']);
    });
});

describe('Narración', () => {
    it('lee el título y luego la Descripción, una locución por frase, con su progreso', () => {
        const { n, synth, progress, end } = narrator();
        n.narrate('Estanque', DESC, 'es');
        expect(synth.spoken.map((u) => u.text)).toEqual(['Estanque.']);
        for (let i = 0; i < 4; i++) synth.finish();
        expect(synth.spoken.map((u) => u.text)).toEqual(['Estanque.', 'Primera frase.', '¿Segunda?', 'Por cierto, la tercera…', 'y «la cuarta».']);
        expect(progress).toEqual([0, 1, 2, 3, 4]);
        expect(n.progress.total).toBe(5);
        expect(end).not.toHaveBeenCalled();
        synth.finish();
        expect(end).toHaveBeenCalledOnce();
        expect(n.speaking).toBe(false);
    });

    for (const safari of [false, true]) {
        it(`pausar corta la frase y seguir la repite desde el principio${safari ? ' (Safari)' : ''}`, () => {
            const { n, synth } = narrator(fakeSynth([], safari));
            n.narrate('Estanque', DESC, 'es');
            synth.finish();
            n.pause();
            expect(n.paused).toBe(true);
            expect(synth.spoken).toHaveLength(2);
            n.resume();
            expect(synth.spoken.map((u) => u.text).slice(-1)).toEqual(['Primera frase.']);
            expect(n.progress.index).toBe(1);
        });

        it(`parar termina la Narración una sola vez${safari ? ' (Safari)' : ''}`, () => {
            const { n, synth, end } = narrator(fakeSynth([], safari));
            n.narrate('Estanque', DESC, 'es');
            n.stop();
            n.stop();
            expect(end).toHaveBeenCalledOnce();
            expect(synth.spoken).toHaveLength(1);
        });

        it(`cambiar de Narración no la termina${safari ? ' (Safari)' : ''}`, () => {
            const { n, synth, end } = narrator(fakeSynth([], safari));
            n.narrate('Estanque', DESC, 'es');
            n.narrate('Palacio de Cristal', 'Hierro y vidrio.', 'es');
            expect(end).not.toHaveBeenCalled();
            expect(synth.spoken.map((u) => u.text)).toEqual(['Estanque.', 'Palacio de Cristal.']);
        });
    }

    it('una frase que falla se salta', () => {
        const { n, synth } = narrator();
        n.narrate('Estanque', 'Una. Dos.', 'es');
        synth.spoken[0].onerror?.({ error: 'synthesis-failed' });
        expect(synth.spoken.at(-1)?.text).toBe('Una.');
    });
});

describe('Anuncio', () => {
    it('dice el título y resuelve al terminar o al cortarse', async () => {
        const { n, synth } = narrator();
        const done = vi.fn();
        void n.say('Estanque', 'es').then(done);
        expect(synth.spoken[0].text).toBe('Estanque');
        synth.finish();
        await Promise.resolve();
        expect(done).toHaveBeenCalled();

        const cut = n.say('Palacio', 'es');
        n.narrate('Palacio', 'Hierro.', 'es');
        await expect(cut).resolves.toBeUndefined();
    });

    it('sin voz en el navegador, no suena nada y resuelve igual', async () => {
        const n = new WebSpeechNarrator({ synth: undefined, utterance, store });
        const end = vi.fn();
        n.on('end', end);
        expect(n.available).toBe(false);
        await expect(n.say('Estanque', 'es')).resolves.toBeUndefined();
        n.narrate('Estanque', 'Grande.', 'es');
        expect(end).toHaveBeenCalledOnce();
    });
});

describe('Voces', () => {
    const helena = voice('Microsoft Helena', 'es-ES');
    const paulina = voice('Paulina', 'es-MX');
    const google = voice('Google español', 'es-ES', false);
    const daniel = voice('Daniel', 'en-GB');
    const samantha = voice('Samantha', 'en-US');

    it('prefiere el locale exacto y luego la calidad aparente', () => {
        const { n } = narrator(fakeSynth([paulina, helena, google, samantha, daniel]));
        expect(n.voicesFor('es').map((v) => v.name)).toEqual(['Google español', 'Microsoft Helena', 'Paulina']);
        expect(n.voiceFor('en')?.name).toBe('Daniel');
    });

    it('usa la voz de cada idioma en sus locuciones', () => {
        const { n, synth } = narrator(fakeSynth([helena, daniel]));
        n.narrate('Pond', 'Big.', 'en');
        expect(synth.spoken[0]).toMatchObject({ voice: daniel, lang: 'en-GB' });
    });

    it('recuerda la voz elegida, y elegir la recomendada vuelve al automático', () => {
        const synth = fakeSynth([helena, paulina]);
        const { n } = narrator(synth);
        n.setVoice('es', paulina.voiceURI);
        expect(narrator(synth).n.voiceFor('es')?.name).toBe('Paulina');
        n.setVoice('es', helena.voiceURI);
        expect(store.get('voices')).toEqual({});
    });

    it('si la voz elegida desaparece, vuelve a la mejor', () => {
        const synth = fakeSynth([helena, paulina]);
        narrator(synth).n.setVoice('es', paulina.voiceURI);
        const { n } = narrator(fakeSynth([helena]));
        expect(n.voiceFor('es')?.name).toBe('Microsoft Helena');
    });

    it('avisa cuando llegan voces tarde', () => {
        const synth = fakeSynth([]);
        const { n } = narrator(synth);
        const changed = vi.fn();
        n.on('voices', changed);
        synth.loadVoices([helena]);
        expect(changed).toHaveBeenCalled();
        expect(n.voiceFor('es')?.name).toBe('Microsoft Helena');
    });
});
