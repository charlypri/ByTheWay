/** Eventos tipados mínimos: `on` devuelve cómo darse de baja. */
export class Emitter<Events extends Record<string, unknown>> {
    private listeners: { [K in keyof Events]?: Set<(value: Events[K]) => void> } = {};

    on<K extends keyof Events>(event: K, fn: (value: Events[K]) => void): () => void {
        (this.listeners[event] ??= new Set()).add(fn);
        return () => this.listeners[event]?.delete(fn);
    }

    protected emit<K extends keyof Events>(event: K, value: Events[K]) {
        this.listeners[event]?.forEach((fn) => fn(value));
    }
}
