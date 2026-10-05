// Narrador: dice los Anuncios y lee las Narraciones. En castellano usa los audios pregenerados con
// la voz Elvira (ADR 0006) y, si falta alguno, la voz del navegador (Web Speech).
import type { ClipPlayer } from './clips';
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
    /** Audios pregenerados; sin ellos, todo lo lee la voz del navegador. */
    clips?: ClipPlayer;
}

/**
 * Las voces Eloquence de iOS, que suenan robóticas. iOS las da en todos los idiomas y van primero
 * por orden alfabético: sin esto, la elección automática caía en Eddy en vez de en Mónica.
 */
const ROBOTIC = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

function voiceScore(v: SpeechSynthesisVoice, lang: Lang) {
    const tag = v.lang.replace('_', '-').toLowerCase();
    const locale = LOCALES[lang].findIndex((l) => tag.startsWith(l.toLowerCase()));
    if (locale < 0) return -1;
    let s = 100 - locale * 10;
    if (ROBOTIC.test(v.name)) s -= 50;
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
    /** La frase actual suena con un audio pregenerado, que sí se puede pausar a media frase. */
    private onClip = false;

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
        return !!this.deps.synth || !!this.deps.clips;
    }

    get progress(): NarrationProgress {
        return { index: this.index, total: this.sentences.length };
    }

    voicesFor(lang: Lang): VoiceOption[] {
        const own = this.ranked(lang).map(toOption);
        return this.deps.clips?.lang === lang ? [this.deps.clips.voice, ...own] : own;
    }

    voiceFor(lang: Lang): VoiceOption | undefined {
        if (this.usesClips(lang)) return this.deps.clips!.voice;
        const v = this.voice(lang);
        return v && toOption(v);
    }

    setVoice(lang: Lang, id: string | null) {
        if (id && id !== this.voicesFor(lang)[0]?.id) this.preferred[lang] = id;
        else delete this.preferred[lang];
        this.deps.store.set('voices', this.preferred);
    }

    unlock() {
        // iOS solo deja hablar después de una locución lanzada desde un gesto del usuario.
        this.deps.clips?.unlock();
        const u = this.deps.synth && this.deps.utterance(' ');
        if (!u) return;
        u.volume = 0;
        this.deps.synth!.speak(u);
    }

    say(text: string, lang: Lang): Promise<void> {
        return new Promise((resolve) => this.line(text, lang, this.token, resolve));
    }

    narrate(title: string, description: string, lang: Lang) {
        this.cut();
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
        if (this.onClip) this.deps.clips!.pause();
        else this.cut();
        this.emit('progress', this.progress);
    }

    resume() {
        if (!this.speaking || !this.paused) return;
        this.paused = false;
        if (!this.onClip) return this.playFrom(this.index);
        this.deps.clips!.resume();
        this.emit('progress', this.progress);
    }

    stop() {
        this.cut();
        if (!this.speaking) return;
        this.speaking = false;
        this.paused = false;
        this.emit('end', undefined);
    }

    private playFrom(start: number) {
        const token = ++this.token;
        const next = (i: number) => {
            if (token !== this.token) return;
            if (i >= this.sentences.length || !this.available) {
                this.speaking = false;
                this.emit('end', undefined);
                return;
            }
            this.index = i;
            this.emit('progress', this.progress);
            if (i + 1 < this.sentences.length && this.usesClips(this.lang)) this.deps.clips!.prefetch(this.sentences[i + 1]);
            // Una frase que falla se salta; las cortadas a propósito ya no tienen el token.
            this.line(this.sentences[i], this.lang, token, () => next(i + 1));
        };
        next(start);
    }

    /** Corta lo que suene: las frases de antes ya no tienen el token y callan. */
    private cut() {
        this.token++;
        this.onClip = false;
        this.deps.clips?.stop();
        this.deps.synth?.cancel();
    }

    /**
     * Dice un texto con su audio pregenerado o, si no lo hay, con la voz del navegador, y llama a
     * `done` al terminar, fallar o cortarse. La voz del navegador empieza en el mismo momento.
     */
    private line(text: string, lang: Lang, token: number, done: () => void) {
        const speak = () => {
            const synth = this.deps.synth;
            if (!synth) return done();
            const u = this.utterance(text, lang);
            u.onend = u.onerror = () => done();
            this.current = u;
            synth.speak(u);
        };
        if (!this.usesClips(lang)) return speak();
        this.onClip = true;
        void this.deps.clips!.play(text).then((result) => {
            if (token !== this.token) return done();
            this.onClip = false;
            if (result === 'missing') speak();
            else done();
        });
    }

    private usesClips(lang: Lang) {
        const clips = this.deps.clips;
        return !!clips && clips.lang === lang && (this.preferred[lang] ?? clips.voice.id) === clips.voice.id;
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

/** El Narrador del navegador, o uno mudo si no hay Web Speech ni audios. */
export function browserNarrator(store: KeyValueStore, clips?: ClipPlayer): Narrator {
    const synth = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
    return new WebSpeechNarrator({ synth, utterance: (text) => new SpeechSynthesisUtterance(text), store, clips });
}
