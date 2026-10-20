import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { moveSection, resolveOrder, STATS_SECTIONS } from '../analytics/sectionOrder';
import { bodyFatSeries, crewCounts, metricSeries, monthlyKm, shoeTotals, summary } from '../analytics/stats';
import BarChart from '../components/charts/BarChart';
import LineChart from '../components/charts/LineChart';
import RaceRecords from '../components/RaceRecords';
import { db } from '../db/db';
import { getStatsOrder, setStatsOrder } from '../db/layout';
const km = (n) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export default function Stats() {
    const days = useLiveQuery(() => db.days.orderBy('date').toArray());
    const shoeList = useLiveQuery(() => db.shoes.toArray());
    const inbody = useLiveQuery(() => db.inbody.toArray());
    // wrapped so "no saved order" (undefined) is told apart from "still loading"
    const savedOrder = useLiveQuery(async () => ({ value: await getStatsOrder() }));
    const [arranging, setArranging] = useState(false);
    if (!days || !shoeList || !inbody || !savedOrder)
        return null;
    const order = resolveOrder(savedOrder.value);
    if (!days.length) {
        return (_jsxs("section", { children: [_jsx("h1", { className: "mb-4 text-2xl font-bold", children: "\uD1B5\uACC4" }), _jsxs("div", { className: "rounded-xl bg-white p-4 text-sm shadow-sm", children: [_jsx("p", { className: "font-semibold", children: "\uC544\uC9C1 \uC800\uC7A5\uB41C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }), _jsx("p", { className: "mt-1 text-slate-500", children: "\u2699\uFE0F \uC124\uC815 \u2192 \uC6B4\uB3D9 \uAE30\uB85D \uAC00\uC838\uC624\uAE30\uC5D0\uC11C \uAE30\uB85D\uC744 \uC77D\uACE0 \uC800\uC7A5\uD558\uBA74 \uC6D4\uBCC4 \uAC70\uB9AC, \uCCB4\uC9C0\uBC29\uB960 \uCD94\uC138, \uC2E0\uBC1C\uBCC4 \uAC70\uB9AC\uAC00 \uC5EC\uAE30\uC5D0 \uB098\uC635\uB2C8\uB2E4." })] })] }));
    }
    const s = summary(days, today());
    const months = monthlyKm(days).slice(-24);
    const bodyFat = bodyFatSeries(days, inbody);
    const bp = metricSeries(days, 'systolicBp');
    const shoes = shoeTotals(days, shoeList).filter((sh) => sh.km > 0);
    const crews = crewCounts(days);
    const lastBf = bodyFat.at(-1);
    const bfChange = lastBf && bodyFat.length > 1 ? lastBf.value - bodyFat[0].value : undefined;
    const sections = {
        summary: (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Tile, { label: "\uB204\uC801 \uB7EC\uB2DD", value: km(s.totalKm), sub: `${s.runDays}일 달림` }), _jsx(Tile, { label: `${s.year}년 러닝`, value: km(s.yearKm) }), _jsx(Tile, { label: "\uCD5C\uADFC 4\uC8FC \uC8FC\uD3C9\uADE0", value: km(s.weeklyAvgKm4w) }), _jsx(Tile, { label: "\uCCB4\uC9C0\uBC29\uB960", value: lastBf ? `${lastBf.value}%` : '-', sub: bfChange != null ? `처음보다 ${bfChange > 0 ? '+' : ''}${bfChange.toFixed(1)}%p` : undefined })] })),
        monthly: (_jsx(Card, { title: "\uC6D4\uBCC4 \uB7EC\uB2DD \uAC70\uB9AC", note: months.length === 24 ? '최근 24개월' : undefined, children: _jsx(BarChart, { data: months.map((m) => ({ label: m.month, value: m.km })), axisLabel: (m, i) => (m.endsWith('-01') || i === 0 ? `${m.slice(2, 4)}.${m.slice(5)}` : ''), format: (d) => `${d.label.replace('-', '년 ')}월 · ${km(d.value)}` }) })),
        bodyFat: bodyFat.length > 1 && (_jsx(Card, { title: "\uCCB4\uC9C0\uBC29\uB960 (%)", children: _jsx(LineChart, { data: bodyFat, format: (d) => `${d.date} · ${d.value}%` }) })),
        bp: bp.length > 1 && (_jsx(Card, { title: "\uD608\uC555 (\uC218\uCD95\uAE30, mmHg)", children: _jsx(LineChart, { data: bp, format: (d) => `${d.date} · ${d.value}` }) })),
        races: _jsx(RaceRecords, { days: days }),
        crews: crews.length > 0 && (_jsx(Card, { title: "\uD06C\uB8E8 \uD65C\uB3D9", children: _jsx("ul", { className: "text-sm", children: crews.map((c) => (_jsxs("li", { className: "flex justify-between py-1 tabular-nums", children: [_jsx("span", { className: "font-semibold", children: c.crew }), _jsxs("span", { children: [c.runs, "\uD68C \u00B7 ", km(c.km)] })] }, c.crew))) }) })),
        shoes: shoes.length > 0 && (_jsx(Card, { title: "\uC2E0\uBC1C\uBCC4 \uB204\uC801 \uAC70\uB9AC", children: _jsx("ul", { className: "space-y-2", children: shoes.map((sh) => (_jsxs("li", { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: `font-semibold ${sh.retired ? 'text-slate-400' : ''}`, children: [sh.shoe, sh.retired && _jsx("span", { className: "ml-1 text-xs font-normal", children: "(\uC740\uD1F4)" })] }), _jsxs("span", { className: "tabular-nums", children: [km(sh.km), " ", _jsxs("span", { className: "text-xs text-slate-500", children: ["\u00B7 ", sh.runs, "\uD68C", sh.lastUsed ? ` · 최근 ${sh.lastUsed.slice(5).replace('-', '.')}` : ''] })] })] }), _jsx("div", { className: "mt-1 h-1.5 rounded-full bg-slate-100", children: _jsx("div", { className: "h-1.5 rounded-full bg-teal-700", style: { width: `${(sh.km / shoes[0].km) * 100}%` } }) })] }, sh.shoe))) }) })),
    };
    return (_jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uD1B5\uACC4" }), _jsx("button", { onClick: () => setArranging(!arranging), className: "text-sm text-teal-700", children: arranging ? '완료' : '순서 바꾸기' })] }), arranging ? (_jsx(ArrangeList, { order: order })) : (order.map((id) => sections[id] && _jsx("div", { children: sections[id] }, id)))] }));
}
function ArrangeList({ order }) {
    const title = (id) => STATS_SECTIONS.find((x) => x.id === id).title;
    const save = (next) => setStatsOrder(next);
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("p", { className: "mb-3 text-sm text-slate-500", children: "\uD654\uC0B4\uD45C\uB85C \uD56D\uBAA9 \uC704\uCE58\uB97C \uBC14\uAFB8\uC138\uC694. \uBC14\uB85C \uC800\uC7A5\uB429\uB2C8\uB2E4." }), _jsx("ol", { className: "divide-y divide-slate-100", children: order.map((id, i) => (_jsxs("li", { className: "flex items-center gap-2 py-2", children: [_jsx("span", { className: "w-5 text-right text-xs text-slate-400 tabular-nums", children: i + 1 }), _jsx("span", { className: "flex-1 font-semibold", children: title(id) }), _jsx("button", { onClick: () => save(moveSection(order, id, -1)), disabled: i === 0, "aria-label": `${title(id)} 위로`, className: "h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30", children: "\u2191" }), _jsx("button", { onClick: () => save(moveSection(order, id, 1)), disabled: i === order.length - 1, "aria-label": `${title(id)} 아래로`, className: "h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30", children: "\u2193" })] }, id))) }), _jsx("button", { onClick: () => setStatsOrder(undefined), className: "mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600", children: "\uAE30\uBCF8 \uC21C\uC11C\uB85C \uB418\uB3CC\uB9AC\uAE30" })] }));
}
function Tile({ label, value, sub }) {
    return (_jsxs("div", { className: "rounded-xl bg-white p-3 shadow-sm", children: [_jsx("div", { className: "text-xs text-slate-500", children: label }), _jsx("div", { className: "text-xl font-bold tabular-nums", children: value }), sub && _jsx("div", { className: "text-xs text-slate-500 tabular-nums", children: sub })] }));
}
function Card({ title, note, children }) {
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-baseline justify-between", children: [_jsx("h2", { className: "font-semibold", children: title }), note && _jsx("span", { className: "text-xs text-slate-500", children: note })] }), children] }));
}
