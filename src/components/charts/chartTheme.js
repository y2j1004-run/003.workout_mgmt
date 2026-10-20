// One accent hue for every single-series chart; text stays in ink colors, never the series color.
export const SERIES = '#0f766e'; // teal-700, the app accent
export const SERIES_WASH = 'rgba(15, 118, 110, 0.1)';
export const GRID = '#e2e8f0'; // slate-200
export const AXIS_TEXT = '#64748b'; // slate-500
export const SURFACE = '#ffffff';
export const W = 340;
export const PAD = { top: 12, right: 8, bottom: 22, left: 34 };
export function niceMax(v) {
    if (v <= 0)
        return 1;
    const step = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10])
        if (v <= m * step)
            return m * step;
    return 10 * step;
}
/** Round bounds and a step from 1/2/5 x 10^n so tick labels stay short (e.g. 80, 90, 100). */
export function niceRange(min, max, count = 4) {
    const raw = Math.max((max - min) / count, 0.1);
    const p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    return { lo, hi: hi === lo ? lo + step : hi, step };
}
export function ticks(min, max, count = 4) {
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}
