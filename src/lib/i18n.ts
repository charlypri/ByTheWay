// Todos los textos de la app, en castellano e inglés (sección 9). Ninguna cadena suelta en el código.
import type { Lang } from './kml';

const es = {
    // Inicio
    tagline: 'Un guía que te avisa al pasar junto a cada lugar y te lo cuenta si quieres.',
    start: 'Empezar',
    startHint: 'Te avisaremos al pasar junto a cada lugar. Lleva la pantalla encendida.',
    loading: 'Cargando lugares…',
    legendNew: 'Por descubrir',
    legendAnnounced: 'Anunciado',
    languageSwitch: 'Idioma',
    // Mapa
    mapLabel: 'Mapa',
    guide: 'Guía',
    recenter: 'Recentrar',
    north: 'Norte arriba',
    view3d: 'Vista 3D',
    view3dOn: 'Vista 3D activada',
    view3dOff: 'Vista 3D desactivada',
    settings: 'Ajustes',
    openPlace: 'Abrir {t}',
    // Estados
    heard: 'Escuchado',
    announced: 'Anunciado hoy',
    playingNow: 'Sonando ahora',
    // Distancias
    distance: 'a {d} de ti',
    nearYou: 'Estás aquí',
    leftBehind: 'Lo has dejado atrás',
    // Ficha, tarjeta y reproductor
    listen: 'Escuchar',
    listenAgain: 'Volver a escuchar',
    read: 'Leer',
    pause: 'Pausar',
    resume: 'Seguir',
    stop: 'Parar',
    close: 'Cerrar',
    dismiss: 'Descartar',
    onlyInSpanish: 'Solo en castellano',
    noDescription: 'Este lugar aún no tiene descripción.',
    closesIn: 'Se cierra en {n} s',
    narrating: 'Narrando',
    paused: 'En pausa',
    sentence: 'Frase {i} de {n}',
    next: 'A continuación',
    more: 'y {n} más',
    // Ajustes
    language: 'Idioma',
    voice: 'Voz',
    voiceHint: 'La que dice los Anuncios y lee las Narraciones.',
    voiceBest: '{v} · recomendada',
    voiceSample: 'Así sonará tu guía.',
    pocket: 'Modo bolsillo',
    pocketHint: 'Pantalla negra para llevar el móvil en el bolsillo. La guía sigue avisando.',
    pocketOn: 'Activar modo bolsillo',
    pocketExit: 'Toca dos veces para salir',
    guideOn: 'La guía sigue contigo',
    startOver: 'Empezar de cero',
    startOverHint: 'Todos los lugares vuelven a anunciarse, también los que ya escuchaste.',
    startOverAsk: '¿Empezar de cero?',
    startOverConfirm: 'Se volverán a anunciar todos los lugares, también los que ya escuchaste.',
    startOverDone: 'Hecho: todos los lugares se volverán a anunciar',
    cancel: 'Cancelar',
    // Estados vacíos y errores
    noVoices: 'Este navegador no puede leer en voz alta.',
    locationDenied: 'Sin tu ubicación no podemos avisarte. Actívala en los ajustes del navegador.',
    locationUnavailable: 'No encontramos tu ubicación. Prueba a cielo abierto.',
    locationUnsupported: 'Este navegador no da acceso a la ubicación. Puedes explorar los lugares en el mapa.',
    noData: 'Necesitamos conexión la primera vez para descargar los lugares.',
    retry: 'Reintentar',
    farAway: 'El lugar más cercano está a {d}.',
    showNearest: 'Ver en el mapa',
    // Simulador (?sim)
    simTitle: 'Simulador',
    simNote: 'Paseo de prueba por el Retiro. Arrastra la flecha para moverte.',
    simPlay: 'Andar',
    simPause: 'Parar',
    simRestart: 'Volver al inicio',
    simProfile: 'Cómo te mueves',
    walk: 'A pie',
    bike: 'En bici',
    car: 'En coche',
    simClock: 'Velocidad del reloj',
    simGps: 'Usar mi GPS',
};

type Strings = typeof es;
export type StringKey = keyof Strings;

const en: Strings = {
    tagline: 'A guide that tells you when you pass each place, and its story if you ask.',
    start: 'Start',
    startHint: "We'll let you know as you pass each place. Keep your screen on.",
    loading: 'Loading places…',
    legendNew: 'New',
    legendAnnounced: 'Announced',
    languageSwitch: 'Language',
    mapLabel: 'Map',
    guide: 'Guide',
    recenter: 'Recenter',
    north: 'North up',
    view3d: '3D view',
    view3dOn: '3D view on',
    view3dOff: '3D view off',
    settings: 'Settings',
    openPlace: 'Open {t}',
    heard: 'Heard',
    announced: 'Announced today',
    playingNow: 'Playing now',
    distance: '{d} away',
    nearYou: "You're here",
    leftBehind: "You've passed it",
    listen: 'Listen',
    listenAgain: 'Listen again',
    read: 'Read',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    close: 'Close',
    dismiss: 'Dismiss',
    onlyInSpanish: 'Spanish only',
    noDescription: "This place doesn't have a description yet.",
    closesIn: 'Closes in {n} s',
    narrating: 'Narrating',
    paused: 'Paused',
    sentence: 'Sentence {i} of {n}',
    next: 'Up next',
    more: 'and {n} more',
    language: 'Language',
    voice: 'Voice',
    voiceHint: 'The one that says the announcements and reads the stories.',
    voiceBest: '{v} · recommended',
    voiceSample: 'This is how your guide will sound.',
    pocket: 'Pocket mode',
    pocketHint: 'Black screen for carrying your phone in a pocket. The guide keeps announcing.',
    pocketOn: 'Turn on pocket mode',
    pocketExit: 'Double-tap to exit',
    guideOn: 'The guide is still with you',
    startOver: 'Start over',
    startOverHint: "Every place will be announced again, including the ones you've heard.",
    startOverAsk: 'Start over?',
    startOverConfirm: "Every place will be announced again, including the ones you've already heard.",
    startOverDone: 'Done: every place will be announced again',
    cancel: 'Cancel',
    noVoices: "This browser can't read aloud.",
    locationDenied: "Without your location we can't let you know. Turn it on in your browser settings.",
    locationUnavailable: "We can't find your location. Try somewhere with open sky.",
    locationUnsupported: "This browser doesn't give access to your location. You can explore the places on the map.",
    noData: 'We need a connection the first time to download the places.',
    retry: 'Try again',
    farAway: 'The nearest place is {d} away.',
    showNearest: 'Show on map',
    simTitle: 'Simulator',
    simNote: 'Test walk through the Retiro. Drag the arrow to move.',
    simPlay: 'Walk',
    simPause: 'Stop',
    simRestart: 'Back to start',
    simProfile: 'How you move',
    walk: 'On foot',
    bike: 'By bike',
    car: 'By car',
    simClock: 'Clock speed',
    simGps: 'Use my GPS',
};

const STRINGS: Record<Lang, Strings> = { es, en };

export const LOCALE = { es: 'es-ES', en: 'en-GB' } as const satisfies Record<Lang, string>;

export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
    const raw = STRINGS[lang][key];
    return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw;
}

/** Por debajo de 1 km, redondeado a 5 m ("120 m"); por encima, con un decimal ("1,2 km" / "1.2 km"). */
export function formatDistance(m: number, lang: Lang): string {
    const metres = Math.round(m / 5) * 5;
    if (metres < 1000) return `${metres} m`;
    return `${(m / 1000).toLocaleString(LOCALE[lang], { maximumFractionDigits: 1 })} km`;
}

/** La Descripción es un único texto; solo se parte en párrafos para mostrarla. */
export const paragraphs = (description: string) =>
    description
        .split(/\n/)
        .map((p) => p.trim())
        .filter(Boolean);
