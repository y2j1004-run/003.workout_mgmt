import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AXIS_TEXT, GRID, niceRange, PAD, SERIES, SERIES_WASH, SURFACE, W } from './chartTheme';
// Single-series line over time (x spaced by real dates). Tap anywhere to read the nearest point.
export default function LineChart({ data, format, height = 170 }) {
    const [sel, setSel] = useState(data.length - 1);
    const values = data.map((d) => d.value);
    const { lo, hi, step } = niceRange(Math.min(...values), Math.max(...values));
    const tickValues = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + step * i);
    const t0 = Date.parse(data[0].date);
    const t1 = Date.parse(data.at(-1).date);
    const plotW = W - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const x = (date) => PAD.left + (t1 === t0 ? plotW / 2 : ((Date.parse(date) - t0) / (t1 - t0)) * plotW);
    const y = (v) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
    const pts = data.map((d) => [x(d.date), y(d.value)]);
    const path = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
    const area = `${path} L${pts.at(-1)[0]},${PAD.top + plotH} L${pts[0][0]},${PAD.top + plotH} Z`;
    const years = [...new Set(data.map((d) => d.date.slice(0, 4)))];
    const pick = (e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - box.left) / box.width) * W;
        let best = 0;
        pts.forEach(([qx], i) => {
            if (Math.abs(qx - px) < Math.abs(pts[best][0] - px))
                best = i;
        });
        setSel(best);
    };
    const [sx, sy] = pts[sel];
    return (_jsxs("figure", { children: [_jsx("figcaption", { className: "mb-1 h-5 text-sm font-semibold tabular-nums", children: format(data[sel]) }), _jsxs("svg", { viewBox: `0 0 ${W} ${height}`, className: "w-full touch-none select-none", role: "img", onPointerDown: pick, onPointerMove: pick, children: [tickValues.map((t) => (_jsxs("g", { children: [_jsx("line", { x1: PAD.left, x2: W - PAD.right, y1: y(t), y2: y(t), stroke: GRID, strokeWidth: 1 }), _jsx("text", { x: PAD.left - 4, y: y(t) + 3, textAnchor: "end", fontSize: 9, fill: AXIS_TEXT, children: Number.isInteger(step) ? t : t.toFixed(1) })] }, t))), years.map((yr) => {
                        const first = data.find((d) => d.date.startsWith(yr)).date;
                        const at = Math.max(PAD.left, x(first <= `${yr}-01-01` ? first : `${yr}-01-01`));
                        return (_jsx("text", { x: at, y: height - 6, fontSize: 9, fill: AXIS_TEXT, children: yr }, yr));
                    }), _jsx("path", { d: area, fill: SERIES_WASH }), _jsx("path", { d: path, fill: "none", stroke: SERIES, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }), _jsx("line", { x1: sx, x2: sx, y1: PAD.top, y2: PAD.top + plotH, stroke: AXIS_TEXT, strokeWidth: 1, opacity: 0.4 }), _jsx("circle", { cx: sx, cy: sy, r: 5, fill: SERIES, stroke: SURFACE, strokeWidth: 2 })] })] }));
}
