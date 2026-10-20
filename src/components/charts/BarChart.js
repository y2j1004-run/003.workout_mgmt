import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AXIS_TEXT, GRID, niceMax, PAD, SERIES, ticks, W } from './chartTheme';
// Single-series column chart. Tap a column to read its value; the latest one is shown by default.
export default function BarChart({ data, axisLabel, format, height = 180 }) {
    const [sel, setSel] = useState(data.length - 1);
    const max = niceMax(Math.max(...data.map((d) => d.value)));
    const plotW = W - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const band = plotW / data.length;
    const barW = Math.min(24, Math.max(2, band - 2)); // 2px surface gap between neighbours
    const y = (v) => PAD.top + plotH - (v / max) * plotH;
    const current = data[sel];
    return (_jsxs("figure", { children: [_jsx("figcaption", { className: "mb-1 h-5 text-sm font-semibold tabular-nums", children: current && format(current) }), _jsxs("svg", { viewBox: `0 0 ${W} ${height}`, className: "w-full touch-none select-none", role: "img", children: [ticks(0, max).map((t) => (_jsxs("g", { children: [_jsx("line", { x1: PAD.left, x2: W - PAD.right, y1: y(t), y2: y(t), stroke: GRID, strokeWidth: 1 }), _jsx("text", { x: PAD.left - 4, y: y(t) + 3, textAnchor: "end", fontSize: 9, fill: AXIS_TEXT, children: Math.round(t) })] }, t))), data.map((d, i) => {
                        const x = PAD.left + band * i + (band - barW) / 2;
                        const h = Math.max(0, PAD.top + plotH - y(d.value));
                        const r = Math.min(4, barW / 2, h);
                        const top = PAD.top + plotH - h;
                        const label = axisLabel(d.label, i);
                        return (_jsxs("g", { onPointerDown: () => setSel(i), onPointerEnter: () => setSel(i), style: { cursor: 'pointer' }, children: [_jsx("rect", { x: PAD.left + band * i, y: PAD.top, width: band, height: plotH, fill: "transparent" }), h > 0 && (_jsx("path", { d: `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`, fill: SERIES, opacity: i === sel ? 1 : 0.55 })), label && (_jsx("text", { x: PAD.left + band * i + band / 2, y: height - 6, textAnchor: "middle", fontSize: 9, fill: AXIS_TEXT, children: label }))] }, d.label));
                    })] })] }));
}
