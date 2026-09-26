// Iconos de la interfaz, como SVG en línea (decorativos: el nombre accesible va en el botón).
const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICONS = {
    play: svg('<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>'),
    playRound: svg('<path d="M8 5.6v12.8a1 1 0 0 0 1.5.85l10-6.4a1 1 0 0 0 0-1.7l-10-6.4A1 1 0 0 0 8 5.6z" fill="currentColor"/>'),
    pause: svg('<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
    stop: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>'),
    text: svg('<path d="M5 6h14M5 10.5h14M5 15h14M5 19.5h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
    close: svg('<path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    closeBold: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
    chevron: svg('<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    chevronDown: svg('<path d="M6.5 9.5 12 15l5.5-5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
    settings: svg(
        '<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7.5h9M18 7.5h2M4 16.5h3M11 16.5h9"/><circle cx="15.5" cy="7.5" r="2.3"/><circle cx="8.5" cy="16.5" r="2.3"/></g>',
    ),
    recenter: svg('<path d="M12 2.8l7.2 17.6L12 16.3l-7.2 4.1z" fill="currentColor"/>'),
    gps: svg(
        '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></g>',
    ),
    flask: svg(
        '<path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
};
