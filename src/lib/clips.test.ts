import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioClips, clipKey, clipTexts } from './clips';

describe('clipKey', () => {
    it('da el mismo nombre al mismo texto, aunque cambien los espacios de los extremos o la forma Unicode', async () => {
        const key = await clipKey('Estanque');
        expect(key).toMatch(/^[0-9a-f]{20}$/);
        expect(await clipKey('  Estanque ')).toBe(key);
        expect(await clipKey('Mónica')).toBe(await clipKey('Mónica'));
        expect(await clipKey('Estanque.')).not.toBe(key);
    });
});

describe('clipTexts', () => {
    it('graba el título del Anuncio y las frases de la Narración, sin repetir', () => {
        expect(clipTexts('Estanque', 'Grande. Muy grande.')).toEqual(['Estanque', 'Estanque.', 'Grande.', 'Muy grande.']);
        expect(clipTexts('¿Qué es?', '')).toEqual(['¿Qué es?']);
    });
});

/** Un <audio> falso: `play` funciona y `finish` simula el final. */
function fakeAudio() {
    const audio = {
        src: '',
        playing: false,
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
        play: vi.fn(() => {
            audio.playing = true;
            return Promise.resolve();
        }),
        pause: vi.fn(() => (audio.playing = false)),
        finish: () => audio.onended?.(),
    };
    return audio;
}

describe('audioClips', () => {
    afterEach(() => vi.unstubAllGlobals());

    function setup(ok: boolean) {
        const fetch = vi.fn((_url: string) => Promise.resolve(new Response(ok ? 'mp3' : null, { status: ok ? 200 : 404 })));
        vi.stubGlobal('fetch', fetch);
        const audio = fakeAudio();
        const clips = audioClips('/ByTheWay/', audio as unknown as HTMLAudioElement);
        return { fetch, audio, clips };
    }

    it('descarga el audio por su nombre y resuelve al terminar', async () => {
        const { fetch, audio, clips } = setup(true);
        const done = clips.play('Estanque');
        await vi.waitFor(() => expect(audio.play).toHaveBeenCalled());
        expect(fetch.mock.calls[0][0]).toBe(`/ByTheWay/audio/${await clipKey('Estanque')}.mp3`);
        audio.finish();
        await expect(done).resolves.toBe('end');
    });

    it('sin audio en el servidor (o sin red) resuelve `missing`', async () => {
        const { clips } = setup(false);
        await expect(clips.play('Estanque')).resolves.toBe('missing');
    });

    it('parar corta el audio y, si aún se descargaba, ya no suena', async () => {
        const { audio, clips } = setup(true);
        const done = clips.play('Estanque');
        clips.stop();
        await expect(done).resolves.toBe('stopped');
        expect(audio.play).not.toHaveBeenCalled();
    });

    it('pausado mientras se descarga, espera a seguir para sonar', async () => {
        const { audio, clips } = setup(true);
        const done = clips.play('Estanque');
        clips.pause();
        await new Promise((r) => setTimeout(r, 10));
        expect(audio.play).not.toHaveBeenCalled();
        clips.resume();
        expect(audio.play).toHaveBeenCalledOnce();
        audio.finish();
        await expect(done).resolves.toBe('end');
    });

    it('lo descargado de antemano no se vuelve a pedir', async () => {
        const { fetch, audio, clips } = setup(true);
        clips.prefetch('Estanque');
        const done = clips.play('Estanque');
        await vi.waitFor(() => expect(audio.play).toHaveBeenCalled());
        audio.finish();
        await done;
        expect(fetch).toHaveBeenCalledOnce();
    });
});
