import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { fmtTime, shoeTotals } from '../analytics/stats';
import ShoePicker from '../components/ShoePicker';
import ThemePicker from '../components/ThemePicker';
import { themeOf } from '../analytics/themes';
import { addRun, db, deleteRun, editRun, setRunShoe, updateShoe } from '../db/db';
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const km = (n) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`;
export default function Workout() {
    const days = useLiveQuery(() => db.days.orderBy('date').toArray());
    const shoes = useLiveQuery(() => db.shoes.toArray());
    if (!days || !shoes)
        return null;
    const totals = shoeTotals(days, shoes);
    // shoes in rotation, most recently used first
    const active = totals
        .filter((t) => !t.retired)
        .sort((a, b) => (b.lastUsed ?? '').localeCompare(a.lastUsed ?? ''))
        .map((t) => t.shoe);
    return (_jsxs("section", { className: "space-y-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uC6B4\uB3D9" }), _jsx(RunForm, { shoes: active }), _jsx(RecentRuns, { days: days, shoes: active }), _jsx(MyShoes, { totals: totals })] }));
}
function RunForm({ shoes }) {
    const [date, setDate] = useState(today);
    const [distance, setDistance] = useState('');
    const [shoe, setShoe] = useState(shoes[0]);
    const [theme, setTheme] = useState();
    const [msg, setMsg] = useState('');
    const valid = Number(distance) > 0;
    const save = async () => {
        if (!valid)
            return;
        await addRun(date, Number(distance), shoe, theme);
        setMsg(`${date.slice(5).replace('-', '.')} 러닝 ${km(Number(distance))}${theme ? ` · ${theme}` : ''}${shoe ? ` · ${shoe}` : ''} 저장했습니다.`);
        setDistance('');
        setTheme(undefined);
    };
    return (_jsxs(Card, { title: "\uB7EC\uB2DD \uAE30\uB85D\uD558\uAE30", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("label", { className: "flex-1 text-xs text-slate-500", children: ["\uB0A0\uC9DC", _jsx("input", { id: "run-date", type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" })] }), _jsxs("label", { className: "w-28 text-xs text-slate-500", children: ["\uAC70\uB9AC(km)", _jsx("input", { id: "run-km", type: "number", inputMode: "decimal", step: "0.1", min: "0", value: distance, onChange: (e) => setDistance(e.target.value), placeholder: "10.2", className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" })] })] }), _jsx("p", { className: "mt-3 mb-1 text-xs text-slate-500", children: "\uB7EC\uB2DD \uC8FC\uC81C" }), _jsx(ThemePicker, { id: "run-theme", value: theme, onPick: setTheme }, msg), _jsx("p", { className: "mt-3 mb-1 text-xs text-slate-500", children: "\uC2E0\uBC1C" }), _jsx(ShoePicker, { id: "run-shoe", options: shoes, value: shoe, onPick: setShoe, allowNone: true }), _jsx("button", { onClick: save, disabled: !valid, className: "mt-4 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-40", children: "\uC800\uC7A5" }), msg && _jsx("p", { className: "mt-2 text-sm text-teal-700", children: msg })] }));
}
function RecentRuns({ days, shoes }) {
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [editing, setEditing] = useState();
    const [editingRun, setEditingRun] = useState();
    const [limit, setLimit] = useState(15);
    const runs = days
        .flatMap((d) => d.activities.map((a, i) => ({ ...a, date: d.date, index: i })))
        .filter((a) => a.kind === 'run' && !a.deleted && (!onlyMissing || !a.shoe))
        .reverse();
    if (!days.length) {
        return (_jsx(Card, { title: "\uCD5C\uADFC \uB7EC\uB2DD", children: _jsx("p", { className: "text-sm text-slate-500", children: "\uC704\uC5D0\uC11C \uB7EC\uB2DD\uC744 \uC800\uC7A5\uD558\uAC70\uB098 \u2699\uFE0F \uC124\uC815\uC5D0\uC11C \uAE30\uB85D\uC744 \uAC00\uC838\uC624\uBA74 \uC5EC\uAE30\uC5D0 \uB098\uC635\uB2C8\uB2E4." }) }));
    }
    return (_jsxs(Card, { title: "\uCD5C\uADFC \uB7EC\uB2DD", children: [_jsxs("label", { className: "mb-2 flex items-center gap-2 text-sm", children: [_jsx("input", { id: "only-missing-shoe", type: "checkbox", checked: onlyMissing, onChange: (e) => setOnlyMissing(e.target.checked) }), "\uC2E0\uBC1C\uC744 \uC548 \uACE0\uB978 \uB7EC\uB2DD\uB9CC"] }), _jsx("ul", { className: "divide-y divide-slate-100", children: runs.slice(0, limit).map((r) => {
                    const key = `${r.date}#${r.index}`;
                    return (_jsxs("li", { className: "py-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("button", { onClick: () => setEditingRun(editingRun === key ? undefined : key), className: "min-w-0 flex-1 text-left text-sm", "aria-label": "\uB7EC\uB2DD \uC218\uC815", children: [_jsx("span", { className: "font-semibold tabular-nums", children: r.date.slice(2).replaceAll('-', '.') }), _jsx("span", { className: "ml-2 tabular-nums", children: km(r.distanceKm) }), (() => {
                                                const t = themeOf(r);
                                                return t.theme ? (_jsx("span", { className: `ml-1 rounded-full px-1.5 py-0.5 text-[11px] ${t.inferred ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-800'}`, children: t.theme })) : null;
                                            })(), (r.event || r.place) && _jsxs("span", { className: "ml-1 truncate text-xs text-slate-500", children: ["\u00B7 ", r.event ?? r.place] }), r.garmin && (_jsxs("div", { className: "text-xs text-slate-500 tabular-nums", children: ["\u231A ", r.garmin.durationSec ? `${fmtTime(r.garmin.durationSec)} · ${fmtTime(Math.round(r.garmin.durationSec / r.garmin.distanceKm))}/km` : `${r.garmin.distanceKm}km`, r.garmin.avgHr ? ` · 심박 ${r.garmin.avgHr}` : '', r.garmin.cadence ? ` · ${r.garmin.cadence}spm` : ''] }))] }), _jsx("button", { onClick: () => setEditing(editing === key ? undefined : key), className: `shrink-0 rounded-full px-3 py-1 text-xs ${r.shoe ? 'bg-slate-100 text-slate-700' : 'border border-amber-400 text-amber-700'}`, children: r.shoe ? `👟 ${r.shoe}` : '신발 선택' })] }), editingRun === key && _jsx(RunEditor, { run: r, onDone: () => setEditingRun(undefined) }), editing === key && (_jsx("div", { className: "mt-2", children: _jsx(ShoePicker, { id: `shoe-${key}`, options: shoes, value: r.shoe, allowNone: true, onPick: async (s) => {
                                        await setRunShoe(r.date, r.index, s);
                                        setEditing(undefined);
                                    } }) }))] }, key));
                }) }), _jsx("p", { className: "mt-2 text-xs text-slate-400", children: "\uB0A0\uC9DC\uB098 \uAC70\uB9AC\uB97C \uB204\uB974\uBA74 \uC218\uC815\u00B7\uC0AD\uC81C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }), runs.length > limit && (_jsxs("button", { onClick: () => setLimit(limit + 30), className: "mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm", children: ["\uB354 \uBCF4\uAE30 (", runs.length - limit, "\uAC1C \uB0A8\uC74C)"] }))] }));
}
function RunEditor({ run, onDone }) {
    const [date, setDate] = useState(run.date);
    const [distance, setDistance] = useState(String(run.distanceKm));
    const [place, setPlace] = useState(run.place ?? '');
    const [theme, setTheme] = useState(themeOf(run).theme);
    const [time, setTime] = useState(() => {
        const t = run.durationSec ?? 0;
        return t ? { h: String(Math.floor(t / 3600)), m: String(Math.floor((t % 3600) / 60)), s: String(t % 60) } : { h: '', m: '', s: '' };
    });
    const [confirmDelete, setConfirmDelete] = useState(false);
    const key = `${run.date}-${run.index}`;
    const valid = Number(distance) > 0 && !!date;
    const seconds = Number(time.h || 0) * 3600 + Number(time.m || 0) * 60 + Number(time.s || 0);
    return (_jsxs("div", { className: "mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("label", { className: "flex-1 text-xs text-slate-500", children: ["\uB0A0\uC9DC", _jsx("input", { id: `run-date-${key}`, type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900" })] }), _jsxs("label", { className: "w-24 text-xs text-slate-500", children: ["\uAC70\uB9AC(km)", _jsx("input", { id: `run-km-${key}`, type: "number", inputMode: "decimal", step: "0.01", value: distance, onChange: (e) => setDistance(e.target.value), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900" })] })] }), _jsxs("label", { className: "block text-xs text-slate-500", children: ["\uC7A5\uC18C", _jsx("input", { id: `run-place-${key}`, value: place, onChange: (e) => setPlace(e.target.value), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900" })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["\uB7EC\uB2DD \uC8FC\uC81C", _jsx("div", { className: "mt-1", children: _jsx(ThemePicker, { id: `run-theme-${key}`, value: theme, onPick: setTheme }) })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["\uAE30\uB85D (\uC120\uD0DD)", _jsx("div", { className: "mt-1 flex items-center gap-1 text-sm text-slate-900 tabular-nums", children: ['h', 'm', 's'].map((k, i) => (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("input", { id: `run-${k}-${key}`, type: "number", inputMode: "numeric", min: "0", value: time[k], onChange: (e) => setTime({ ...time, [k]: e.target.value }), className: "w-14 rounded-lg border border-slate-300 px-2 py-1 text-right" }), _jsx("span", { className: "text-xs text-slate-500", children: ['시간', '분', '초'][i] })] }, k))) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: !valid, onClick: async () => {
                            await editRun(run.date, run.index, { date, distanceKm: Number(distance), place: place.trim() || undefined, theme, durationSec: seconds || undefined });
                            onDone();
                        }, className: "flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40", children: "\uC800\uC7A5" }), _jsx("button", { onClick: onDone, className: "rounded-lg bg-slate-200 px-4 py-2", children: "\uCDE8\uC18C" })] }), confirmDelete ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1 text-xs text-red-700", children: "\uC774 \uB7EC\uB2DD\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?" }), _jsx("button", { onClick: () => setConfirmDelete(false), className: "rounded-lg bg-slate-200 px-3 py-1.5", children: "\uC544\uB2C8\uC694" }), _jsx("button", { onClick: async () => {
                            await deleteRun(run.date, run.index);
                            onDone();
                        }, className: "rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white", children: "\uC0AD\uC81C" })] })) : (_jsx("button", { onClick: () => setConfirmDelete(true), className: "w-full rounded-lg border border-red-300 py-2 text-red-700", children: "\uC0AD\uC81C\u2026" }))] }));
}
function MyShoes({ totals }) {
    const [editing, setEditing] = useState();
    const [initial, setInitial] = useState('');
    if (!totals.length)
        return null;
    return (_jsxs(Card, { title: "\uB0B4 \uC2E0\uBC1C", children: [_jsx("p", { className: "mb-2 text-xs text-slate-500", children: "\uAE30\uB85D\uD558\uAE30 \uC804\uC5D0 \uC774\uBBF8 \uB2EC\uB9B0 \uAC70\uB9AC\uAC00 \uC788\uC73C\uBA74 \"\uC774\uC804 \uAC70\uB9AC\"\uC5D0 \uB123\uC5B4 \uC8FC\uC138\uC694. \uB204\uC801 \uAC70\uB9AC\uC5D0 \uB354\uD574\uC9D1\uB2C8\uB2E4." }), _jsx("ul", { className: "divide-y divide-slate-100", children: totals.map((t) => (_jsxs("li", { className: "py-2", children: [_jsxs("button", { onClick: () => {
                                setEditing(editing === t.shoe ? undefined : t.shoe);
                                setInitial(String(t.km - t.loggedKm || ''));
                            }, className: "flex w-full items-baseline justify-between text-left text-sm", children: [_jsxs("span", { className: `font-semibold ${t.retired ? 'text-slate-400' : ''}`, children: [t.shoe, t.retired && _jsx("span", { className: "ml-1 text-xs font-normal", children: "(\uC740\uD1F4)" })] }), _jsxs("span", { className: "tabular-nums", children: [km(t.km), " ", _jsxs("span", { className: "text-xs text-slate-500", children: ["\u00B7 ", t.runs, "\uD68C"] })] })] }), editing === t.shoe && (_jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-sm", children: [_jsxs("label", { className: "flex items-center gap-1 text-xs text-slate-500", children: ["\uC774\uC804 \uAC70\uB9AC", _jsx("input", { id: `initial-${t.shoe}`, type: "number", inputMode: "decimal", min: "0", value: initial, onChange: (e) => setInitial(e.target.value), className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900" }), "km"] }), _jsx("button", { onClick: () => updateShoe(t.shoe, { initialKm: Number(initial) || 0 }).then(() => setEditing(undefined)), className: "rounded-lg bg-teal-700 px-3 py-1 text-white", children: "\uC800\uC7A5" }), _jsx("button", { onClick: () => updateShoe(t.shoe, { retired: !t.retired }).then(() => setEditing(undefined)), className: "rounded-lg bg-slate-200 px-3 py-1", children: t.retired ? '다시 신기' : '은퇴시키기' })] }))] }, t.shoe))) })] }));
}
function Card({ title, children }) {
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-3 font-semibold", children: title }), children] }));
}
