// Almacenamiento clave-valor del dispositivo, inyectable para poder testear lo que se guarda.

export interface KeyValueStore {
    get<T>(key: string): T | undefined;
    set(key: string, value: unknown): void;
    remove(key: string): void;
}

const PREFIX = 'btw:';

/** localStorage con JSON. Sin almacenamiento (modo privado, cuota llena) todo vive solo en memoria. */
export function localStore(storage: Storage | undefined = globalThis.localStorage): KeyValueStore {
    const fallback = memoryStore();
    return {
        get<T>(key: string) {
            try {
                const raw = storage?.getItem(PREFIX + key);
                return raw == null ? fallback.get<T>(key) : (JSON.parse(raw) as T);
            } catch {
                return fallback.get<T>(key);
            }
        },
        set(key, value) {
            fallback.set(key, value);
            try {
                storage?.setItem(PREFIX + key, JSON.stringify(value));
            } catch {
                // sin almacenamiento persistente: queda el valor en memoria
            }
        },
        remove(key) {
            fallback.remove(key);
            try {
                storage?.removeItem(PREFIX + key);
            } catch {
                // nada que borrar
            }
        },
    };
}

export function memoryStore(): KeyValueStore {
    const data = new Map<string, string>();
    return {
        get<T>(key: string) {
            const raw = data.get(key);
            return raw == null ? undefined : (JSON.parse(raw) as T);
        },
        set(key, value) {
            data.set(key, JSON.stringify(value));
        },
        remove(key) {
            data.delete(key);
        },
    };
}
