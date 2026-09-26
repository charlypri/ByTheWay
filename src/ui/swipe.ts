import type { Action } from 'svelte/action';

interface SwipeOptions {
    /** Lo que se mueve con el dedo; por defecto, el propio elemento. */
    moving?: HTMLElement | null;
    onDone: () => void;
    enabled?: () => boolean;
}

/** Deslizar hacia abajo para descartar (tarjeta del Anuncio) o cerrar (ficha). */
export const swipeDown: Action<HTMLElement, SwipeOptions> = (handle, initial) => {
    let opts = initial;
    let y0: number | null = null;
    let dy = 0;
    // Un arrastre no es un toque: el botón donde empezó no se pulsa.
    let dragged = false;
    const moving = () => opts.moving ?? handle;

    const click = (e: MouseEvent) => {
        if (dragged) e.stopPropagation();
        dragged = false;
    };
    const down = (e: PointerEvent) => {
        dragged = false;
        if (opts.enabled && !opts.enabled()) return;
        if (e.button !== 0) return;
        y0 = e.clientY;
        dy = 0;
    };
    const move = (e: PointerEvent) => {
        if (y0 == null) return;
        dy = Math.max(0, e.clientY - y0);
        if (dy > 6) {
            moving().style.transition = 'none';
            moving().style.transform = `translateY(${dy}px)`;
        }
    };
    const end = () => {
        if (y0 == null) return;
        y0 = null;
        moving().style.transition = '';
        moving().style.transform = '';
        dragged = dy > 6;
        if (dy > 70) opts.onDone();
    };

    handle.addEventListener('click', click, { capture: true });
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    return {
        update(next) {
            opts = next;
        },
        destroy() {
            handle.removeEventListener('click', click, { capture: true });
            handle.removeEventListener('pointerdown', down);
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
        },
    };
};
