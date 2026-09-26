/** Aviso breve y no hablado: se añadió un Anuncio a la cola mientras suena una Narración. */
export interface Chime {
    /** Debe llamarse dentro de un toque del usuario: los navegadores no dejan sonar audio sin él. */
    unlock(): void;
    play(): void;
}

export function webAudioChime(): Chime {
    let ctx: AudioContext | null = null;
    return {
        unlock() {
            try {
                ctx ??= new AudioContext();
                void ctx.resume();
            } catch {
                ctx = null;
            }
        },
        play() {
            if (!ctx) return;
            const now = ctx.currentTime;
            [784, 1047].forEach((freq, i) => {
                const o = ctx!.createOscillator();
                const g = ctx!.createGain();
                const t0 = now + i * 0.13;
                o.type = 'sine';
                o.frequency.value = freq;
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
                o.connect(g).connect(ctx!.destination);
                o.start(t0);
                o.stop(t0 + 0.55);
            });
        },
    };
}
