// Audios pregenerados con la voz Elvira (ADR 0006): uno por frase, generados en el despliegue con
// `npm run voice`. Cada fichero se llama como el hash de su texto, así que la app no necesita lista:
// calcula el nombre, lo descarga y, si no está, el Narrador usa la voz del navegador.
import type { Lang } from './kml';
import { narrationSentences, type VoiceOption } from './narrator';

/** La voz de los audios. Cambiarla cambia todos los nombres y obliga a regenerarlos. */
export const CLIP_VOICE: VoiceOption = { id: 'clips:es-ES-ElviraNeural', name: 'Elvira', lang: 'es-ES' };
/** Solo hay audios en castellano: el inglés lo lee siempre la voz del navegador. */
export const CLIP_LANG: Lang = 'es';
/** Una frase que tarda más en llegar se dice con la voz del navegador. */
const LOAD_TIMEOUT_MS = 5000;
/** Un WAV de un milisegundo en silencio, para desbloquear el audio dentro del toque (iOS). */
const SILENCE = 'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==';

/** Nombre del audio de un texto, sin extensión. El build lo calcula igual. */
export async function clipKey(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(`${CLIP_VOICE.id}\n${text.normalize('NFC').trim()}`);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(hash.slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lo que se graba de un POI: el título (el Anuncio) y las frases de su Narración. */
export const clipTexts = (title: string, description: string) => [...new Set([title, ...narrationSentences(title, description)])];

/** `end`: sonó entero. `missing`: no hay audio o no pudo sonar. `stopped`: se cortó a propósito. */
export type ClipResult = 'end' | 'missing' | 'stopped';

export interface ClipPlayer {
    readonly voice: VoiceOption;
    readonly lang: Lang;
    /** Debe llamarse dentro de un toque del usuario (iOS). */
    unlock(): void;
    play(text: string): Promise<ClipResult>;
    pause(): void;
    resume(): void;
    stop(): void;
    /** Descarga de antemano un audio, para que la frase siguiente empiece sin espera. */
    prefetch(text: string): void;
}

/**
 * Los audios se descargan con `fetch` y suenan desde un blob: así pasan por el service worker,
 * que los guarda para usarlos sin red, y Safari no les pide trozos (Range) que la caché no sirve.
 */
export function audioClips(base: string, audio: HTMLAudioElement = new Audio()): ClipPlayer {
    const loads = new Map<string, Promise<Blob | null>>();
    let pending: ((r: ClipResult) => void) | null = null;
    let objectUrl = '';
    /** Cambia en cada `play` y `stop`: una descarga que llega tarde ya no suena. */
    let turn = 0;
    /** Pausado mientras se descarga: el audio espera a `resume` para sonar. */
    let paused = false;

    const settle = (r: ClipResult) => {
        const done = pending;
        pending = null;
        done?.(r);
    };
    audio.onended = () => settle('end');
    audio.onerror = () => settle('missing');

    const load = (text: string) => {
        let blob = loads.get(text);
        if (!blob) {
            blob = clipKey(text)
                .then((key) => fetch(`${base}audio/${key}.mp3`, { signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) }))
                .then((res) => (res.ok ? res.blob() : null))
                .catch(() => null);
            loads.set(text, blob);
            // Un fallo se vuelve a intentar la próxima vez (la red puede haber vuelto).
            void blob.then((b) => b || loads.delete(text));
        }
        return blob;
    };

    return {
        voice: CLIP_VOICE,
        lang: CLIP_LANG,
        unlock() {
            audio.src = SILENCE;
            audio.play().catch(() => {});
        },
        async play(text) {
            settle('stopped');
            paused = false;
            const mine = ++turn;
            const blob = await load(text);
            if (mine !== turn) return 'stopped';
            if (!blob) return 'missing';
            loads.delete(text);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = URL.createObjectURL(blob);
            return new Promise<ClipResult>((resolve) => {
                pending = resolve;
                audio.src = objectUrl;
                if (!paused) audio.play().catch(() => pending === resolve && settle('missing'));
            });
        },
        pause() {
            paused = true;
            audio.pause();
        },
        resume() {
            paused = false;
            if (pending) audio.play().catch(() => settle('missing'));
        },
        stop() {
            turn++;
            paused = false;
            audio.pause();
            settle('stopped');
        },
        prefetch(text) {
            void load(text);
        },
    };
}
