import type { Lang } from '../../src/lib/kml';

const STRINGS = {
    es: {
        start: 'Empezar',
        startHint: 'Te avisaremos al pasar junto a cada lugar. Lleva la pantalla encendida.',
        listen: 'Escuchar',
        pause: 'Pausar',
        resume: 'Seguir',
        stop: 'Parar',
        close: 'Cerrar',
        recenter: 'Recentrar',
        north: 'Norte arriba',
        next: 'A continuación',
        nearYou: 'Estás aquí',
        heard: 'Escuchado',
        settings: 'Ajustes',
        language: 'Idioma',
        darkMap: 'Mapa oscuro',
        pocket: 'Modo bolsillo',
        pocketExit: 'Toca dos veces para salir',
        resetSession: 'Reiniciar sesión',
        resetHeard: 'Borrar escuchados (solo mock)',
        simulate: 'Simular paseo',
        simPause: 'Pausar simulación',
        useGps: 'Usar mi GPS',
        onlyInSpanish: 'Solo en castellano',
        noDescription: 'Este lugar aún no tiene descripción.',
        walk: 'A pie',
        bike: 'En bici',
        car: 'En coche',
        away: 'de ti',
    },
    en: {
        start: 'Start',
        startHint: "We'll let you know as you pass each place. Keep your screen on.",
        listen: 'Listen',
        pause: 'Pause',
        resume: 'Resume',
        stop: 'Stop',
        close: 'Close',
        recenter: 'Recenter',
        north: 'North up',
        next: 'Up next',
        nearYou: "You're here",
        heard: 'Heard',
        settings: 'Settings',
        language: 'Language',
        darkMap: 'Dark map',
        pocket: 'Pocket mode',
        pocketExit: 'Double-tap to exit',
        resetSession: 'Reset session',
        resetHeard: 'Clear heard places (mock only)',
        simulate: 'Simulate walk',
        simPause: 'Pause simulation',
        useGps: 'Use my GPS',
        onlyInSpanish: 'Spanish only',
        noDescription: "This place doesn't have a description yet.",
        walk: 'On foot',
        bike: 'By bike',
        car: 'By car',
        away: 'away',
    },
} satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof (typeof STRINGS)['es'];

export const t = (lang: Lang, key: StringKey) => STRINGS[lang][key];

export function formatDistance(m: number | null, lang: Lang): string {
    if (m == null) return '';
    const locale = lang === 'es' ? 'es-ES' : 'en-GB';
    if (m < 1000) return `${Math.round(m / 5) * 5} m`;
    return `${(m / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`;
}

/** La Descripción es un único texto; solo se parte en párrafos para mostrarla. */
export const paragraphs = (description: string) =>
    description
        .split(/\n\s*\n|\n/)
        .map((p) => p.trim())
        .filter(Boolean);

/** Mantiene la pantalla encendida (ADR 0002); se re-adquiere al volver a la página. */
export function keepScreenOn() {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
        try {
            if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
        } catch {
            lock = null;
        }
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !lock?.released) void acquire();
        else if (document.visibilityState === 'visible') void acquire();
    });
    void acquire();
}
