// Narrador: dice los Anuncios y lee las Narraciones. La interfaz `Narrator` no sabe de Web Speech,
// para poder cambiarla por MP3 pregenerados si la prueba del #2 no convence (sección 7).
import { Emitter } from './emitter';
import type { Lang } from './kml';
import type { KeyValueStore } from './storage';

export interface NarrationProgress {
    /** Frase que suena ahora; la 0 es el título. */
    index: number;
    total: number;
}

export interface VoiceOption {
    id: string;
    name: string;
    lang: string;
}

export type NarratorEvents = {
    progress: NarrationProgress;
    /** La Narración ha terminado o se ha parado. Cambiar de Narración no la termina. */
    end: void;
    /** Cambió la lista de voces (algunos navegadores las cargan tarde). */
    voices: void;
};

export interface Narrator extends Pick<Emitter<NarratorEvents>, 'on'> {
    /** ¿Puede este navegador leer en voz alta? */
    readonly available: boolean;
    readonly speaking: boolean;
    readonly paused: boolean;
    readonly progress: NarrationProgress;
    /** Debe llamarse dentro de un toque del usuario (iOS). */
    unlock(): void;
    /** Anuncio: dice un texto corto y resuelve al terminar o cortarse. No toca la Narración. */
    say(text: string, lang: Lang): Promise<void>;
    narrate(title: string, description: string, lang: Lang): void;
    pause(): void;
    resume(): void;
    stop(): void;
    /** Voces que sirven para un idioma, de mejor a peor. */
    voicesFor(lang: Lang): VoiceOption[];
    /** La voz que sonará en ese idioma: la elegida o, si no, la mejor. */
    voiceFor(lang: Lang): VoiceOption | undefined;
    /** `null` vuelve a la elección automática. */
    setVoice(lang: Lang, id: string | null): void;
}

const LOCALES: Record<Lang, string[]> = { es: ['es-ES', 'es'], en: ['en-GB', 'en-US', 'en'] };

/** Partes de la Descripción que se leen de una en una: el corte de Chrome a los ~15 s no llega. */
export function splitSentences(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .flatMap((para) => para.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) ?? [])
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Las frases de una Narración: el título y luego la Descripción. */
export const narrationSentences = (title: string, description: string) => [/[.!?…]$/.test(title) ? title : `${title}.`, ...splitSentences(description)];

// ---------------------------------------------------------------------------
// Web Speech

/** Lo que usamos de `speechSynthesis`, para poder sustituirlo en los tests. */
export interface SpeechSynthesisLike {
    speak(u: SpeechSynthesisUtterance): void;
    cancel(): void;
    getVoices(): SpeechSynthesisVoice[];
    addEventListener(type: 'voiceschanged', fn: () => void): void;
}

export interface WebSpeechDeps {
    synth: SpeechSynthesisLike | undefined;
    utterance: (text: string) => SpeechSynthesisUtterance;
    store: KeyValueStore;
}

function voiceScore(v: SpeechSynthesisVoice, lang: Lang) {
    const tag = v.lang.replace('_', '-').toLowerCase();
    const locale = LOCALES[lang].findIndex((l) => tag.startsWith(l.toLowerCase()));
    if (locale < 0) return -1;
    let s = 100 - locale * 10;
    if (/premium|enhanced|natural|neural|google/i.test(v.name)) s += 5;
    if (v.localService) s += 2;
    return s;
}

export class WebSpeechNarrator extends Emitter<NarratorEvents> implements Narrator {
    speaking = false;
    paused = false;
    private voices: SpeechSynthesisVoice[] = [];
    private preferred: Partial<Record<Lang, string>>;
    private sentences: string[] = [];
    private index = 0;
    private lang: Lang = 'es';
    /** Cada locución lleva el token de su tanda; al cortar se cambia y las antiguas callan. */
    private token = 0;
    /** Chrome en Android libera las locuciones sin referencia antes de su `end`. */
    private current: SpeechSynthesisUtterance | null = null;

    constructor(private readonly deps: WebSpeechDeps) {
        super();
        this.preferred = deps.store.get<Partial<Record<Lang, string>>>('voices') ?? {};
        if (deps.synth) {
            this.voices = deps.synth.getVoices();
            deps.synth.addEventListener('voiceschanged', () => {
                this.voices = deps.synth!.getVoices();
                this.emit('voices', undefined);
            });
        }
    }

    get available() {
        return !!this.deps.synth;
    }

    get progress(): NarrationProgress {
        return { index: this.index, total: this.sentences.length };
    }

    voicesFor(lang: Lang): VoiceOption[] {
        return this.ranked(lang).map(toOption);
    }

    voiceFor(lang: Lang): VoiceOption | undefined {
        const v = this.voice(lang);
        return v && toOption(v);
    }

    setVoice(lang: Lang, id: string | null) {
        if (id && id !== this.ranked(lang)[0]?.voiceURI) this.preferred[lang] = id;
        else delete this.preferred[lang];
        this.deps.store.set('voices', this.preferred);
    }

    unlock() {
        // iOS solo deja hablar después de una locución lanzada desde un gesto del usuario.
        const u = this.deps.synth && this.deps.utterance(' ');
        if (!u) return;
        u.volume = 0;
        this.deps.synth!.speak(u);
    }

    say(text: string, lang: Lang): Promise<void> {
        return new Promise((resolve) => {
            if (!this.deps.synth) return resolve();
            const u = this.utterance(text, lang);
            u.onend = u.onerror = () => resolve();
            this.current = u;
            this.deps.synth.speak(u);
        });
    }

    narrate(title: string, description: string, lang: Lang) {
        this.token++;
        this.deps.synth?.cancel();
        this.lang = lang;
        this.sentences = narrationSentences(title, description);
        this.index = 0;
        this.speaking = true;
        this.paused = false;
        this.playFrom(0);
    }

    /** `pause()` de Web Speech no es fiable en Android: se corta y se retoma desde el inicio de la frase. */
    pause() {
        if (!this.speaking || this.paused) return;
        this.paused = true;
        this.token++;
        this.deps.synth?.cancel();
        this.emit('progress', this.progress);
    }

    resume() {
        if (!this.speaking || !this.paused) return;
        this.paused = false;
        this.playFrom(this.index);
    }

    stop() {
        this.token++;
        this.deps.synth?.cancel();
        if (!this.speaking) return;
        this.speaking = false;
        this.paused = false;
        this.emit('end', undefined);
    }

    private playFrom(start: number) {
        const token = ++this.token;
        const next = (i: number) => {
            if (token !== this.token) return;
            if (i >= this.sentences.length || !this.deps.synth) {
                this.speaking = false;
                this.emit('end', undefined);
                return;
            }
            this.index = i;
            this.emit('progress', this.progress);
            const u = this.utterance(this.sentences[i], this.lang);
            u.onend = () => next(i + 1);
            // Una frase que falla se salta; las cortadas a propósito ya no tienen el token.
            u.onerror = () => next(i + 1);
            this.current = u;
            this.deps.synth.speak(u);
        };
        next(start);
    }

    private ranked(lang: Lang) {
        return this.voices.filter((v) => voiceScore(v, lang) >= 0).sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang));
    }

    private voice(lang: Lang) {
        const id = this.preferred[lang];
        return (id && this.voices.find((v) => v.voiceURI === id)) || this.ranked(lang)[0];
    }

    private utterance(text: string, lang: Lang) {
        const u = this.deps.utterance(text);
        const voice = this.voice(lang);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? LOCALES[lang][0];
        return u;
    }
}

const toOption = (v: SpeechSynthesisVoice): VoiceOption => ({ id: v.voiceURI, name: v.name, lang: v.lang });

/** El Narrador del navegador, o uno mudo si no hay Web Speech. */
export function browserNarrator(store: KeyValueStore): Narrator {
    const synth = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
    return new WebSpeechNarrator({ synth, utterance: (text) => new SpeechSynthesisUtterance(text), store });
}
