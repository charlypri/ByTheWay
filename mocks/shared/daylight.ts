// ¿Es de noche donde está el usuario? Amanecer y atardecer aproximados (algoritmo de la NOAA,
// precisión de un par de minutos), suficiente para decidir el tema del mapa.

const RAD = Math.PI / 180;

/** Horas UTC (decimales) de amanecer y atardecer, o null en día o noche polar. */
export function sunTimesUtc(date: Date, lat: number, lon: number): { rise: number; set: number } | null {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const day = Math.floor((date.getTime() - start) / 86400000);
    const gamma = ((2 * Math.PI) / 365) * (day - 1);
    const eqTime =
        229.18 *
        (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl =
        0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2 * gamma) +
        0.000907 * Math.sin(2 * gamma) -
        0.002697 * Math.cos(3 * gamma) +
        0.00148 * Math.sin(3 * gamma);
    const cosH = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
    if (cosH < -1 || cosH > 1) return null;
    const ha = Math.acos(cosH) / RAD;
    const noon = 720 - 4 * lon - eqTime; // minutos UTC
    return { rise: (noon - 4 * ha) / 60, set: (noon + 4 * ha) / 60 };
}

export function isNight(date: Date, lat: number, lon: number): boolean {
    const t = sunTimesUtc(date, lat, lon);
    if (!t) return Math.abs(lat) > 66 && (date.getUTCMonth() < 3 || date.getUTCMonth() > 8) === lat > 0;
    const h = date.getUTCHours() + date.getUTCMinutes() / 60;
    const norm = (x: number) => ((x % 24) + 24) % 24;
    const rise = norm(t.rise);
    const set = norm(t.set);
    return rise < set ? h < rise || h >= set : h >= set && h < rise;
}

/** El tema oscuro se activa solo: si el sistema lo pide o si es de noche en la posición del usuario. */
export function prefersDark(position: { lat: number; lon: number } | null, date = new Date()): boolean {
    if (matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return position ? isNight(date, position.lat, position.lon) : false;
}
