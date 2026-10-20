import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { goalProgress, runStreak, weekSummary } from '../analytics/home';
import { bodyFatSeries, runsOf } from '../analytics/stats';
import { db } from '../db/db';
import { getGoals } from '../db/goals';
const km = (n) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
export default function Home() {
    const days = useLiveQuery(() => db.days.orderBy('date').toArray());
    const inbody = useLiveQuery(() => db.inbody.orderBy('date').toArray());
    const goals = useLiveQuery(getGoals);
    if (!days || !inbody || !goals)
        return null;
    const now = today();
    const dateLabel = new Date(`${now}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    if (!days.length && !inbody.length) {
        return (_jsxs("section", { className: "space-y-4", children: [_jsx(Header, { date: dateLabel }), _jsx(Card, { title: "\uC2DC\uC791\uD558\uAE30", children: _jsxs("ul", { className: "list-disc space-y-1 pl-5 text-sm text-slate-600", children: [_jsx("li", { children: "\u2699\uFE0F \uC124\uC815 \u2192 \uC6B4\uB3D9 \uAE30\uB85D \uAC00\uC838\uC624\uAE30\uB85C \uBA54\uBAA8\uC7A5 \uAE30\uB85D\uC744 \uB123\uAC70\uB098" }), _jsx("li", { children: "\uD83D\uDCAA \uC6B4\uB3D9 \uD0ED\uC5D0\uC11C \uC624\uB298 \uB7EC\uB2DD\uC744 \uAE30\uB85D\uD558\uC138\uC694." }), _jsx("li", { children: "\u2696\uFE0F \uC778\uBC14\uB514 \uD0ED\uC5D0\uC11C \uCE21\uC815\uAC12\uC744 \uB123\uC73C\uBA74 \uC5EC\uAE30\uC5D0 \uBCC0\uD654\uAC00 \uB098\uC635\uB2C8\uB2E4." })] }) })] }));
    }
    const week = weekSummary(days, now);
    const streak = runStreak(days, now);
    const bodyFat = bodyFatSeries(days, inbody);
    const weights = inbody.filter((r) => r.weightKg != null);
    const progress = goalProgress(goals, days, now, {
        bodyFatPct: bodyFat.at(-1)?.value,
        startBodyFatPct: bodyFat[0]?.value,
        weightKg: weights.at(-1)?.weightKg,
        startWeightKg: weights[0]?.weightKg,
    });
    const recent = runsOf(days).slice(-3).reverse();
    const diff = Math.round((week.km - week.lastWeekKmSoFar) * 10) / 10;
    const maxDay = Math.max(...week.byDay, 1);
    const todayIndex = (new Date(`${now}T00:00:00Z`).getUTCDay() + 6) % 7;
    return (_jsxs("section", { className: "space-y-4", children: [_jsx(Header, { date: dateLabel, streak: streak }), _jsxs(Card, { title: "\uC774\uBC88 \uC8FC", children: [_jsxs("div", { className: "flex items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-3xl font-bold tabular-nums", children: km(week.km) }), _jsxs("div", { className: "text-xs text-slate-500 tabular-nums", children: ["\uC9C0\uB09C\uC8FC \uAC19\uC740 \uC694\uC77C\uAE4C\uC9C0\uBCF4\uB2E4 ", diff === 0 ? '같음' : `${diff > 0 ? '+' : ''}${km(diff)}`] })] }), _jsxs("div", { className: "text-right text-sm tabular-nums", children: [_jsxs("div", { children: ["\uB7EC\uB2DD ", week.runDays, "\uC77C"] }), _jsxs("div", { children: ["\uC6E8\uC774\uD2B8 ", week.strengthDays, "\uC77C"] })] })] }), _jsx("div", { className: "mt-4 flex h-20 items-end gap-1.5", role: "img", "aria-label": "\uC694\uC77C\uBCC4 \uB7EC\uB2DD \uAC70\uB9AC", children: week.byDay.map((v, i) => (_jsxs("div", { className: "flex flex-1 flex-col items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-500 tabular-nums", children: v ? v : '' }), _jsx("div", { className: `w-full max-w-6 rounded-t ${i === todayIndex ? 'bg-teal-700' : 'bg-teal-700/50'}`, style: { height: `${v ? Math.max(4, (v / maxDay) * 48) : 2}px`, opacity: i > todayIndex ? 0.25 : 1 } }), _jsx("span", { className: `text-xs ${i === todayIndex ? 'font-bold text-teal-700' : 'text-slate-500'}`, children: WEEKDAYS[i] })] }, i))) })] }), _jsx(Card, { title: "\uBAA9\uD45C", children: progress.length ? (_jsx("ul", { className: "space-y-3", children: progress.map((g) => (_jsxs("li", { children: [_jsxs("div", { className: "flex items-baseline justify-between text-sm", children: [_jsxs("span", { className: "font-semibold", children: [g.label, " ", g.done && _jsx("span", { className: "text-teal-700", children: "\u2713" })] }), _jsxs("span", { className: "tabular-nums", children: [g.current != null ? `${g.current}${g.unit}` : '-', " ", _jsxs("span", { className: "text-xs text-slate-500", children: ["/ ", g.target, g.unit] })] })] }), _jsx("div", { className: "mt-1 h-2 rounded-full bg-slate-100", children: _jsx("div", { className: "h-2 rounded-full bg-teal-700", style: { width: `${Math.round(g.ratio * 100)}%` } }) })] }, g.key))) })) : (_jsx("p", { className: "text-sm text-slate-500", children: "\u2699\uFE0F \uC124\uC815 \u2192 \uBAA9\uD45C \uC124\uC815\uC5D0\uC11C \uC8FC\uAC04 \uAC70\uB9AC\uB098 \uBAA9\uD45C \uCCB4\uC9C0\uBC29\uB960\uC744 \uC815\uD558\uBA74 \uC9C4\uD589\uB960\uC774 \uB098\uC635\uB2C8\uB2E4." })) }), _jsx(LatestBody, { inbody: inbody, bodyFat: bodyFat }), recent.length > 0 && (_jsx(Card, { title: "\uCD5C\uADFC \uB7EC\uB2DD", children: _jsx("ul", { className: "divide-y divide-slate-100 text-sm", children: recent.map((r, i) => (_jsxs("li", { className: "flex items-baseline justify-between gap-2 py-1.5", children: [_jsxs("span", { className: "min-w-0 truncate", children: [_jsx("span", { className: "tabular-nums", children: r.date.slice(5).replace('-', '.') }), _jsx("span", { className: "ml-2 text-xs text-slate-500", children: r.event ?? r.place ?? '' })] }), _jsxs("span", { className: "shrink-0 tabular-nums", children: [_jsx("b", { children: km(r.distanceKm) }), r.shoe && _jsxs("span", { className: "ml-1 text-xs text-slate-500", children: ["\uD83D\uDC5F ", r.shoe] })] })] }, `${r.date}${i}`))) }) }))] }));
}
function Header({ date, streak = 0 }) {
    return (_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uD648" }), _jsx("p", { className: "text-sm text-slate-500", children: date })] }), streak >= 2 && _jsxs("span", { className: "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 tabular-nums", children: ["\uD83D\uDD25 ", streak, "\uC77C \uC5F0\uC18D \uB7EC\uB2DD"] })] }));
}
function LatestBody({ inbody, bodyFat }) {
    const last = inbody.at(-1);
    const prev = inbody.at(-2);
    if (!last && !bodyFat.length)
        return null;
    const delta = (a, b, unit = '') => {
        if (a == null || b == null)
            return undefined;
        const d = Math.round((a - b) * 10) / 10;
        return `${d > 0 ? '+' : ''}${d}${unit}`;
    };
    if (!last) {
        const bf = bodyFat.at(-1);
        const before = bodyFat.at(-2);
        return (_jsxs(Card, { title: `체지방률 · ${bf.date}`, children: [_jsxs("div", { className: "text-3xl font-bold tabular-nums", children: [bf.value, "%"] }), before && _jsxs("div", { className: "text-xs text-slate-500 tabular-nums", children: ["\uC9C0\uB09C \uCE21\uC815\uBCF4\uB2E4 ", delta(bf.value, before.value, '%p')] })] }));
    }
    const tiles = [
        ['체중', last.weightKg, 'kg', delta(last.weightKg, prev?.weightKg, 'kg')],
        ['골격근량', last.skeletalMuscleKg, 'kg', delta(last.skeletalMuscleKg, prev?.skeletalMuscleKg, 'kg')],
        ['체지방률', last.bodyFatPct, '%', delta(last.bodyFatPct, prev?.bodyFatPct, '%p')],
    ];
    return (_jsxs(Card, { title: `최근 인바디 · ${last.date}`, children: [_jsx("div", { className: "grid grid-cols-3 gap-2", children: tiles.map(([label, v, unit, d]) => (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: label }), _jsx("div", { className: "text-lg font-bold tabular-nums", children: v != null ? `${v}${unit}` : '-' }), d && _jsx("div", { className: "text-xs text-slate-500 tabular-nums", children: d })] }, label))) }), prev && _jsxs("p", { className: "mt-2 text-xs text-slate-400", children: ["\uC9C0\uB09C \uCE21\uC815(", prev.date, ")\uACFC \uBE44\uAD50"] })] }));
}
function Card({ title, children }) {
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-3 font-semibold", children: title }), children] }));
}
