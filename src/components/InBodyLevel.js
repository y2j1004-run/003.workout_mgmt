import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addDays, runsOf } from '../analytics/stats';
import { db } from '../db/db';
import { assessInBody } from '../inbody/assess';
const CHIP = {
    good: { label: '좋음', className: 'bg-teal-50 text-teal-800' },
    ok: { label: '보통', className: 'bg-slate-100 text-slate-600' },
    watch: { label: '주의', className: 'bg-amber-100 text-amber-800' },
};
export default function InBodyLevel({ records }) {
    const days = useLiveQuery(() => db.days.toArray());
    const [open, setOpen] = useState(true);
    if (!days)
        return null;
    const runs = runsOf(days);
    const kmBefore = (date) => {
        const from = addDays(date, -7);
        return runs.filter((r) => r.date >= from && r.date < date).reduce((s, r) => s + r.distanceKm, 0);
    };
    const a = assessInBody(records, runs.length ? kmBefore : undefined);
    if (!a)
        return null;
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsxs("button", { onClick: () => setOpen(!open), className: "flex w-full items-baseline justify-between text-left", children: [_jsxs("h2", { className: "font-semibold", children: ["\uD604\uC7AC \uC218\uC900 \u00B7 ", a.date] }), _jsx("span", { className: "text-xs text-slate-400", children: open ? '접기' : '펼치기' })] }), _jsx("p", { className: "mt-1 text-sm text-slate-700", children: a.headline }), open && (_jsxs(_Fragment, { children: [_jsx("ul", { className: "mt-3 divide-y divide-slate-100", children: a.items.map((i) => (_jsxs("li", { className: "py-2", children: [_jsxs("div", { className: "flex items-baseline justify-between gap-2 text-sm", children: [_jsx("span", { className: "font-semibold", children: i.label }), _jsxs("span", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "tabular-nums", children: i.value }), _jsx("span", { className: `rounded-full px-2 py-0.5 text-xs ${CHIP[i.level].className}`, children: CHIP[i.level].label })] })] }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500", children: i.note })] }, i.key))) }), a.trends.length > 0 && (_jsxs("div", { className: "mt-3", children: [_jsxs("h3", { className: "mb-1 text-xs font-semibold text-slate-500", children: [a.trends[0].since, " \uC774\uD6C4 \uBCC0\uD654"] }), _jsx("div", { className: "grid grid-cols-2 gap-2 text-sm", children: a.trends.map((t) => {
                                    const d = Math.round((t.to - t.from) * 10) / 10;
                                    return (_jsxs("div", { className: "rounded-lg bg-slate-50 px-2 py-1.5", children: [_jsx("div", { className: "text-xs text-slate-500", children: t.label }), _jsxs("div", { className: "tabular-nums", children: [t.from, " \u2192 ", _jsx("b", { children: t.to }), t.unit, " ", _jsxs("span", { className: "text-xs text-slate-500", children: ["(", d > 0 ? '+' : '', d, ")"] })] })] }, t.label));
                                }) })] })), a.suggestions.length > 0 && (_jsxs("div", { className: "mt-3", children: [_jsx("h3", { className: "mb-1 text-xs font-semibold text-slate-500", children: "\uB3C4\uC6C0\uC774 \uB420 \uAC83" }), _jsx("ul", { className: "list-disc space-y-1 pl-5 text-sm text-slate-700", children: a.suggestions.map((s) => (_jsx("li", { children: s }, s))) })] })), _jsx("p", { className: "mt-3 text-xs text-slate-400", children: "\uACB0\uACFC\uC9C0\uC758 \uD45C\uC900 \uBC94\uC704\uC640 \uC77C\uBC18 \uAE30\uC900(\uC131\uC778 \uB0A8\uC131)\uC73C\uB85C \uBCF8 \uCC38\uACE0\uC6A9 \uD574\uC11D\uC774\uBA70 \uC9C4\uB2E8\uC774 \uC544\uB2D9\uB2C8\uB2E4." })] }))] }));
}
