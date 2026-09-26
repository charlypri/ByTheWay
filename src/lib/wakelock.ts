// Pantalla encendida mientras se usa la guía (ADR 0002). El navegador suelta el bloqueo al ocultar
// la página, así que se vuelve a pedir al volver.

export interface WakeLockHost {
    wakeLock?: { request(type: 'screen'): Promise<{ released: boolean; release(): Promise<void> }> };
}

export interface VisibilityHost {
    visibilityState: DocumentVisibilityState;
    addEventListener(type: 'visibilitychange', fn: () => void): void;
    removeEventListener(type: 'visibilitychange', fn: () => void): void;
}

/** Pide el bloqueo y lo re-adquiere en cada vuelta a la página. Devuelve cómo soltarlo. */
export function keepScreenOn(nav: WakeLockHost, doc: VisibilityHost): () => void {
    let lock: { released: boolean; release(): Promise<void> } | null = null;
    let active = true;
    const acquire = async () => {
        if (!nav.wakeLock || doc.visibilityState !== 'visible' || (lock && !lock.released)) return;
        try {
            lock = await nav.wakeLock.request('screen');
            if (!active) void lock.release();
        } catch {
            lock = null; // sin batería suficiente o sin permiso: la guía sigue igual
        }
    };
    const onVisibility = () => void acquire();
    doc.addEventListener('visibilitychange', onVisibility);
    void acquire();
    return () => {
        active = false;
        doc.removeEventListener('visibilitychange', onVisibility);
        void lock?.release();
        lock = null;
    };
}
