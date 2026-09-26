// Iconos del mapa y sus gemelos SVG para la interfaz, para que la ficha y el mapa hablen igual.
// Paleta de la B: grafito por escuchar, ámbar anunciado, gris con ✓ escuchado, rojo sonando, azul tú.
import type { PoiState } from '../lib/guide';

export const COLORS = { ink: '#15181B', red: '#DF1B12', amber: '#FFB100', grey: '#8A9199', blue: '#1F6FEB' };
const ICON_SCALE = 2.6;

/** Dibuja un icono en un lienzo a 2x y lo devuelve como ImageData para el mapa. */
export function drawIcon(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): ImageData {
    const px = size * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    draw(ctx, size);
    return ctx.getImageData(0, 0, px, px);
}

/** Disco con aro blanco y sombra, centrado en el origen. */
function disc(x: CanvasRenderingContext2D, r: number, fill: string) {
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.45)';
    x.shadowBlur = 4;
    x.shadowOffsetY = 1.5;
    x.beginPath();
    x.arc(0, 0, r + 2.5, 0, Math.PI * 2);
    x.fillStyle = '#FFFFFF';
    x.fill();
    x.restore();
    x.beginPath();
    x.arc(0, 0, r, 0, Math.PI * 2);
    x.fillStyle = fill;
    x.fill();
}

/**
 * Cada icono ocupa solo su disco más la sombra: el lienzo es la caja con la que los nombres
 * esquivan los iconos, así que no debe llevar margen sobrante.
 */
const icon = (r: number, draw: (x: CanvasRenderingContext2D) => void) => {
    const units = (r + 2.5 + 2) * 2;
    return drawIcon(Math.round(units * ICON_SCALE), (x, size) => {
        x.scale(size / units, size / units);
        x.translate(units / 2, units / 2);
        draw(x);
    });
};

function dot(x: CanvasRenderingContext2D, fill: string) {
    x.beginPath();
    x.arc(0, 0, 2.2, 0, Math.PI * 2);
    x.fillStyle = fill;
    x.fill();
}

export function poiIcons(): Record<PoiState, ImageData> {
    return {
        // Por escuchar: disco grafito con aro blanco, el de más contraste.
        pending: icon(6.5, (x) => {
            disc(x, 6.5, COLORS.ink);
            dot(x, '#FFFFFF');
        }),
        // Anunciado: ámbar, sigue invitando.
        announced: icon(7, (x) => {
            disc(x, 7, COLORS.amber);
            dot(x, COLORS.ink);
        }),
        // Escuchado: gris pequeño con ✓, se retira.
        heard: icon(5.5, (x) => {
            disc(x, 5.5, COLORS.grey);
            x.beginPath();
            x.moveTo(-2.6, 0.1);
            x.lineTo(-0.7, 2);
            x.lineTo(2.7, -1.9);
            x.strokeStyle = '#FFFFFF';
            x.lineWidth = 1.9;
            x.lineCap = 'round';
            x.lineJoin = 'round';
            x.stroke();
        }),
        // Sonando: rojo con barras de sonido, el único marcador grande.
        playing: icon(10.5, (x) => {
            disc(x, 10.5, COLORS.red);
            x.fillStyle = '#FFFFFF';
            for (const [dx, h] of [
                [-4.6, 2.8],
                [-1.15, 5.6],
                [2.3, 3.8],
            ]) {
                x.fillRect(dx, -h, 2.4, h * 2);
            }
        }),
    };
}

/** Flecha del usuario; gris mientras el GPS no tiene precisión suficiente. */
/** La flecha se dibuja en una caja de 44 y se muestra a PUCK_PX. */
const PUCK_PX = 54;

export function puckIcon(fill: string): ImageData {
    return drawIcon(PUCK_PX, (x) => {
        x.scale(PUCK_PX / 44, PUCK_PX / 44);
        x.save();
        x.shadowColor = 'rgba(0,0,0,0.45)';
        x.shadowBlur = 5;
        x.shadowOffsetY = 1.5;
        x.beginPath();
        x.moveTo(22, 6);
        x.lineTo(34, 36);
        x.lineTo(22, 29.5);
        x.lineTo(10, 36);
        x.closePath();
        x.fillStyle = fill;
        x.fill();
        x.restore();
        x.lineWidth = 3;
        x.strokeStyle = '#FFFFFF';
        x.lineJoin = 'round';
        x.stroke();
    });
}

/** El mismo icono en la interfaz (leyenda, ficha, "A continuación"). */
export function glyphSvg(state: PoiState): string {
    const k = 'viewBox="0 0 24 24" aria-hidden="true"';
    switch (state) {
        case 'pending':
            return `<svg ${k}><circle cx="12" cy="12" r="10" fill="#fff"/><circle cx="12" cy="12" r="7.2" fill="${COLORS.ink}"/><circle cx="12" cy="12" r="2.5" fill="#fff"/></svg>`;
        case 'announced':
            return `<svg ${k}><circle cx="12" cy="12" r="10.5" fill="#fff"/><circle cx="12" cy="12" r="7.8" fill="${COLORS.amber}"/><circle cx="12" cy="12" r="2.5" fill="${COLORS.ink}"/></svg>`;
        case 'heard':
            return `<svg ${k}><circle cx="12" cy="12" r="9" fill="#fff"/><circle cx="12" cy="12" r="6.6" fill="${COLORS.grey}"/><path d="M9 12.1l2.2 2.2 4-4.3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'playing':
            return `<svg ${k}><circle cx="12" cy="12" r="11" fill="#fff"/><circle cx="12" cy="12" r="8.8" fill="${COLORS.red}"/><rect x="7.6" y="9.6" width="2" height="4.8" fill="#fff"/><rect x="11" y="7.2" width="2" height="9.6" fill="#fff"/><rect x="14.4" y="8.8" width="2" height="6.4" fill="#fff"/></svg>`;
    }
}
