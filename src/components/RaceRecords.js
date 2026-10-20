import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { fmtTime, isRace, personalBests, RACE_DISTANCES, races } from '../analytics/stats';
import { addRace, editRace } from '../db/db';
const km = (n) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}km`;
/** "하프" / "풀" / "10K" for standard distances, otherwise the distance in km */
const distanceLabel = (d) => RACE_DISTANCES.find((x) => Math.abs(x.km - d) < 0.001)?.label ?? km(d);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export default function RaceRecords({ days }) {
    const list = races(days);
    const pbs = personalBests(list);
    const [editing, setEditing] = useState();
    const [adding, setAdding] = useState(false);
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-baseline justify-between", children: [_jsx("h2", { className: "font-semibold", children: "\uB300\uD68C \uAE30\uB85D" }), _jsx("button", { onClick: () => setAdding(!adding), className: "text-sm text-teal-700", children: adding ? '닫기' : '+ 대회 추가' })] }), pbs.length > 0 && (_jsx("div", { className: "mb-3 flex flex-wrap gap-2", children: pbs.map(({ label, race }) => (_jsxs("span", { className: "rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800 tabular-nums", children: [label, " \uCD5C\uACE0 ", _jsx("b", { children: fmtTime(race.durationSec) })] }, label))) })), adding && _jsx(AddRace, { days: days, onDone: () => setAdding(false) }), list.length === 0 && !adding && _jsx("p", { className: "text-sm text-slate-500", children: "\uC544\uC9C1 \uB300\uD68C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \"+ \uB300\uD68C \uCD94\uAC00\"\uB85C \uB123\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }), _jsx("ul", { className: "divide-y divide-slate-100 text-sm", children: list.map((r) => {
                    const key = `${r.date}#${r.index}`;
                    return (_jsxs("li", { className: "py-2", children: [_jsxs("button", { onClick: () => setEditing(editing === key ? undefined : key), className: "flex w-full items-baseline justify-between gap-2 text-left", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-semibold", children: r.event ?? '대회' }), _jsxs("div", { className: "text-xs text-slate-500 tabular-nums", children: [r.date, " \u00B7 ", distanceLabel(r.raceDistanceKm ?? r.distanceKm)] })] }), _jsxs("div", { className: "shrink-0 text-right tabular-nums", children: [_jsx("div", { className: "font-semibold", children: r.durationSec ? fmtTime(r.durationSec) : _jsx("span", { className: "text-amber-600", children: "\uAE30\uB85D \uC5C6\uC74C" }) }), r.paceSecPerKm ? _jsxs("div", { className: "text-xs text-slate-500", children: [fmtTime(r.paceSecPerKm), "/km"] }) : null] })] }), editing === key && _jsx(EditRace, { race: r, onDone: () => setEditing(undefined) })] }, key));
                }) })] }));
}
function EditRace({ race, onDone }) {
    const [form, setForm] = useState(() => ({
        event: race.event ?? '',
        distance: race.raceDistanceKm ?? race.distanceKm,
        ...splitTime(race.durationSec),
    }));
    const id = `${race.date}-${race.index}`;
    return (_jsxs("div", { className: "mt-2 space-y-2 rounded-lg bg-slate-50 p-3", children: [_jsx(RaceFields, { id: id, form: form, setForm: setForm, loggedKm: race.distanceKm }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: async () => {
                            await editRace(race.date, race.index, {
                                event: form.event.trim(),
                                raceDistanceKm: Math.abs(form.distance - race.distanceKm) < 0.001 ? null : form.distance,
                                durationSec: joinTime(form) ?? null,
                            });
                            onDone();
                        }, className: "flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white", children: "\uC800\uC7A5" }), _jsx("button", { onClick: onDone, className: "rounded-lg bg-slate-200 px-4 py-2", children: "\uCDE8\uC18C" })] }), _jsx("button", { onClick: async () => {
                    await editRace(race.date, race.index, { race: false });
                    onDone();
                }, className: "w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600", children: "\uB300\uD68C\uAC00 \uC544\uB2D8 (\uBAA9\uB85D\uC5D0\uC11C \uBE7C\uAE30)" })] }));
}
function AddRace({ days, onDone }) {
    const [date, setDate] = useState(today);
    const [pick, setPick] = useState('new');
    const [form, setForm] = useState({ event: '', distance: 10, h: '', m: '', s: '' });
    const dayRuns = (days.find((d) => d.date === date)?.activities ?? []).map((a, index) => ({ a, index })).filter(({ a }) => a.kind === 'run' && !isRace(a));
    const valid = form.event.trim() && form.distance > 0;
    const save = async () => {
        if (pick === 'new')
            await addRace(date, form.event.trim(), form.distance, joinTime(form));
        else {
            const run = dayRuns.find((r) => r.index === pick).a;
            await editRace(date, pick, {
                race: true,
                event: form.event.trim(),
                raceDistanceKm: Math.abs(form.distance - run.distanceKm) < 0.001 ? null : form.distance,
                durationSec: joinTime(form) ?? null,
            });
        }
        onDone();
    };
    return (_jsxs("div", { className: "mb-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm", children: [_jsx(Field, { label: "\uB0A0\uC9DC", children: _jsx("input", { id: "race-date", type: "date", value: date, onChange: (e) => {
                        setDate(e.target.value);
                        setPick('new');
                    }, className: "w-full rounded-lg border border-slate-300 px-2 py-1.5" }) }), dayRuns.length > 0 && (_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs text-slate-500", children: "\uC774\uB0A0 \uAE30\uB85D\uB41C \uB7EC\uB2DD\uC744 \uB300\uD68C\uB85C \uBC14\uAFB8\uAC70\uB098, \uC0C8\uB85C \uCD94\uAC00\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }), dayRuns.map(({ a, index }) => (_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "radio", name: "race-pick", checked: pick === index, onChange: () => {
                                    setPick(index);
                                    setForm({ ...form, event: form.event || a.event || a.place || '', distance: a.raceDistanceKm ?? a.distanceKm, ...splitTime(a.durationSec) });
                                } }), km(a.distanceKm), " ", a.event ?? a.place ?? ''] }, index))), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "radio", name: "race-pick", checked: pick === 'new', onChange: () => setPick('new') }), "\uC0C8 \uAE30\uB85D\uC73C\uB85C \uCD94\uAC00"] })] })), _jsx(RaceFields, { id: "new-race", form: form, setForm: setForm }), _jsx("button", { onClick: save, disabled: !valid, className: "w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40", children: "\uB300\uD68C \uC800\uC7A5" })] }));
}
function RaceFields({ id, form, setForm, loggedKm }) {
    const preset = RACE_DISTANCES.find((d) => Math.abs(d.km - form.distance) < 0.001);
    return (_jsxs(_Fragment, { children: [_jsx(Field, { label: "\uB300\uD68C\uBA85", children: _jsx("input", { id: `${id}-name`, value: form.event, onChange: (e) => setForm({ ...form, event: e.target.value }), className: "w-full rounded-lg border border-slate-300 px-2 py-1.5" }) }), _jsxs(Field, { label: "\uB300\uD68C \uAC70\uB9AC", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [RACE_DISTANCES.map((d) => (_jsx("button", { type: "button", onClick: () => setForm({ ...form, distance: d.km }), className: `rounded-full border px-3 py-1 text-xs ${preset?.km === d.km ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white'}`, children: d.label }, d.label))), _jsx("input", { id: `${id}-km`, type: "number", inputMode: "decimal", step: "0.1", value: form.distance, onChange: (e) => setForm({ ...form, distance: Number(e.target.value) }), className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums" }), "km"] }), loggedKm != null && Math.abs(loggedKm - form.distance) >= 0.001 && _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["\uADF8\uB0A0 \uB2EC\uB9B0 \uAC70\uB9AC ", km(loggedKm), "\uB294 \uADF8\uB300\uB85C \uB450\uACE0, \uD398\uC774\uC2A4\uB294 \uB300\uD68C \uAC70\uB9AC\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4."] })] }), _jsx(Field, { label: "\uAE30\uB85D", children: _jsx("div", { className: "flex items-center gap-1 tabular-nums", children: ['h', 'm', 's'].map((k, i) => (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("input", { id: `${id}-${k}`, type: "number", inputMode: "numeric", min: "0", max: k === 'h' ? 23 : 59, value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }), className: "w-14 rounded-lg border border-slate-300 px-2 py-1 text-right" }), ['시간', '분', '초'][i]] }, k))) }) })] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "mb-0.5 text-xs text-slate-500", children: label }), children] }));
}
function splitTime(sec) {
    if (!sec)
        return { h: '', m: '', s: '' };
    return { h: String(Math.floor(sec / 3600)), m: String(Math.floor((sec % 3600) / 60)), s: String(sec % 60) };
}
function joinTime(f) {
    const total = Number(f.h || 0) * 3600 + Number(f.m || 0) * 60 + Number(f.s || 0);
    return total > 0 ? total : undefined;
}
