import { describe, expect, it, vi } from 'vitest';
import { keepScreenOn, type VisibilityHost } from './wakelock';

function host() {
    const locks: { released: boolean; release: () => Promise<void> }[] = [];
    const nav = {
        wakeLock: {
            request: vi.fn(async () => {
                const lock = { released: false, release: async () => void (lock.released = true) };
                locks.push(lock);
                return lock;
            }),
        },
    };
    let listener: () => void = () => {};
    const doc: VisibilityHost & { show(): Promise<void>; hide(): void } = {
        visibilityState: 'visible',
        addEventListener: (_t, fn) => (listener = fn),
        removeEventListener: () => (listener = () => {}),
        async show() {
            this.visibilityState = 'visible';
            listener();
            await Promise.resolve();
        },
        hide() {
            this.visibilityState = 'hidden';
            locks.forEach((l) => (l.released = true)); // el navegador lo suelta
            listener();
        },
    };
    return { nav, doc, locks };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('keepScreenOn', () => {
    it('pide el bloqueo y lo vuelve a pedir al volver a la página', async () => {
        const { nav, doc } = host();
        keepScreenOn(nav, doc);
        await flush();
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
        doc.hide();
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
        await doc.show();
        await flush();
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(2);
    });

    it('no pide otro si el que tiene sigue activo', async () => {
        const { nav, doc } = host();
        keepScreenOn(nav, doc);
        await flush();
        await doc.show();
        await flush();
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
    });

    it('se puede soltar, y sin Wake Lock no falla', async () => {
        const { nav, doc, locks } = host();
        const release = keepScreenOn(nav, doc);
        await flush();
        release();
        expect(locks[0].released).toBe(true);
        expect(() => keepScreenOn({}, doc)).not.toThrow();
    });
});
