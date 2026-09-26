// Narrador para los mocks, sobre la Web Speech API.
// Parte el texto en frases (Chrome corta locuciones de más de ~15 s y en Android
// pause() equivale a cancel()), así que "pausar" = parar y retomar en la frase actual.
import type { Lang } from '../../src/lib/kml';

const LOCALES: Record<Lang, string[]> = { es: ['es-ES', 'es'], en: ['en-GB', 'en-US', 'en'] };

export function splitSentences(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .flatMap((para) => para.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) ?? [])
        .map((s) => s.trim())
        .filter(Boolean);
}

export function voicesReady(): Promise<SpeechSynthesisVoice[]> {
    if (!('speechSynthesis' in window)) return Promise.resolve([]);
    const now = speechSynthesis.getVoices();
    if (now.length) return Promise.resolve(now);
    return new Promise((resolve) => {
        const done = () => resolve(speechSynthesis.getVoices());
        speechSynthesis.addEventListener('voiceschanged', done, { once: true });
        setTimeout(done, 1500);
    });
}

function voiceScore(v: SpeechSynthesisVoice, lang: Lang) {
    const locale = LOCALES[lang].findIndex((l) => v.lang.replace('_', '-').toLowerCase().startsWith(l.toLowerCase()));
    if (locale < 0) return -1;
    let s = 100 - locale * 10;
    if (/premium|enhanced|natural|neural|google/i.test(v.name)) s += 5;
    if (v.localService) s += 2;
    return s;
}

/** Voces que sirven para un idioma, de mejor a peor. */
export function voicesForLang(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice[] {
    return voices.filter((v) => voiceScore(v, lang) >= 0).sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang));
}

/** Elige la mejor voz disponible para un idioma: locale exacto, luego calidad aparente. */
export function bestVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | undefined {
    return voicesForLang(voices, lang)[0];
}

export interface NarrationProgress {
    index: number;
    total: number;
}

export class Narrator {
    private voices: SpeechSynthesisVoice[] = [];
    private sentences: string[] = [];
    private index = 0;
    private token = 0;
    lang: Lang = 'es';
    /** Voz elegida a mano por idioma (`voiceURI`). Sin elegir, o si ya no existe, manda `bestVoice`. */
    preferred: Partial<Record<Lang, string>> = {};
    /** Las voces llegan tarde en algunos navegadores: avisa cuando cambia la lista. */
    onVoices: () => void = () => {};
    onProgress: (p: NarrationProgress) => void = () => {};
    onEnd: () => void = () => {};
    speaking = false;
    paused = false;

    async init() {
        this.voices = await voicesReady();
        if ('speechSynthesis' in window) {
            speechSynthesis.addEventListener('voiceschanged', () => {
                this.voices = speechSynthesis.getVoices();
                this.onVoices();
            });
        }
    }

    /** Voces disponibles para un idioma, de mejor a peor. */
    voicesFor(lang: Lang): SpeechSynthesisVoice[] {
        return voicesForLang(this.voices, lang);
    }

    /** La voz que sonará en ese idioma: la elegida o, si no, la mejor. */
    voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
        const uri = this.preferred[lang];
        return (uri && this.voices.find((v) => v.voiceURI === uri)) || bestVoice(this.voices, lang);
    }

    /** iOS exige que la primera locución salga de un gesto del usuario. */
    unlock() {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
    }

    /** Anuncio: dice un texto corto y resuelve al terminar. No afecta a la Narración. */
    say(text: string, lang: Lang): Promise<void> {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) return resolve();
            const u = this.utterance(text, lang);
            u.onend = u.onerror = () => resolve();
            speechSynthesis.speak(u);
        });
    }

    narrate(title: string, description: string, lang: Lang) {
        // Cambiar de Narración no es terminarla: se corta la anterior sin avisar de onEnd.
        this.token++;
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        this.lang = lang;
        this.sentences = [title + '.', ...splitSentences(description)];
        this.index = 0;
        this.speaking = true;
        this.paused = false;
        this.playFrom(this.index);
    }

    pause() {
        if (!this.speaking) return;
        this.paused = true;
        this.token++;
        speechSynthesis.cancel();
        this.onProgress(this.progress);
    }

    resume() {
        if (!this.speaking || !this.paused) return;
        this.paused = false;
        this.playFrom(this.index);
    }

    stop() {
        this.token++;
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        const was = this.speaking;
        this.speaking = false;
        this.paused = false;
        if (was) this.onEnd();
    }

    get progress(): NarrationProgress {
        return { index: this.index, total: this.sentences.length };
    }

    private playFrom(i: number) {
        const token = ++this.token;
        const next = (j: number) => {
            if (token !== this.token) return;
            if (j >= this.sentences.length) {
                this.speaking = false;
                this.onEnd();
                return;
            }
            this.index = j;
            this.onProgress(this.progress);
            const u = this.utterance(this.sentences[j], this.lang);
            u.onend = () => next(j + 1);
            u.onerror = (e) => {
                if (e.error !== 'interrupted' && e.error !== 'canceled') next(j + 1);
            };
            speechSynthesis.speak(u);
        };
        next(i);
    }

    private utterance(text: string, lang: Lang) {
        const u = new SpeechSynthesisUtterance(text);
        const voice = this.voiceFor(lang);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? LOCALES[lang][0];
        u.rate = 1;
        return u;
    }
}
