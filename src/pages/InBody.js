import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import LineChart from '../components/charts/LineChart';
import InBodyLevel from '../components/InBodyLevel';
import { db, saveInBody } from '../db/db';
import { checkRecord, parseInBodyCsv, withLogRecords } from '../inbody/inbody';
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const SOURCE_LABEL = { sheet: '결과지', history: '결과지 추이', manual: '직접 입력', log: '운동 기록' };
export default function InBody() {
    const records = useLiveQuery(() => db.inbody.orderBy('date').toArray());
    const days = useLiveQuery(() => db.days.toArray());
    if (!records || !days)
        return null;
    const latest = records.at(-1);
    // charts and the history list also show what the workout log recorded
    const all = withLogRecords(records, days);
    const series = (key) => all.filter((r) => typeof r[key] === 'number').map((r) => ({ date: r.date, value: r[key] }));
    const charts = [
        { title: '체중 (kg)', data: series('weightKg'), unit: 'kg' },
        { title: '골격근량 (kg)', data: series('skeletalMuscleKg'), unit: 'kg' },
        { title: '체지방률 (%)', data: series('bodyFatPct'), unit: '%' },
    ];
    return (_jsxs("section", { className: "space-y-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uC778\uBC14\uB514" }), latest ? (_jsxs(_Fragment, { children: [_jsx(Latest, { latest: latest, prev: records.at(-2) }), _jsx(InBodyLevel, { records: records })] })) : (_jsx(Card, { title: "\uC544\uC9C1 \uC778\uBC14\uB514 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4", children: _jsxs("p", { className: "text-sm text-slate-500", children: [all.length > 0 && '운동 기록의 체지방률·혈압은 아래 측정 기록에 보입니다. ', "\uC544\uB798\uC5D0\uC11C \uCE21\uC815\uAC12\uC744 \uC9C1\uC811 \uC785\uB825\uD558\uAC70\uB098, \uACB0\uACFC\uC9C0\uB97C \uC77D\uC740 \uAC12\uC744 \uBD99\uC5EC\uB123\uC5B4 \uAC00\uC838\uC624\uC138\uC694."] }) })), charts.map((c) => c.data.length > 1 && (_jsx(Card, { title: c.title, children: _jsx(LineChart, { data: c.data, format: (d) => `${d.date} · ${d.value}${c.unit}` }) }, c.title))), _jsx(ManualEntry, {}), _jsx(PasteImport, {}), all.length > 0 && _jsx(History, { records: all })] }));
}
function Latest({ latest: r, prev }) {
    const delta = (key, unit) => {
        const a = r[key];
        const b = prev?.[key];
        if (typeof a !== 'number' || typeof b !== 'number')
            return undefined;
        const d = Math.round((a - b) * 10) / 10;
        return `${d > 0 ? '+' : ''}${d}${unit}`;
    };
    const tiles = [
        ['체중', r.weightKg, 'kg', delta('weightKg', 'kg')],
        ['골격근량', r.skeletalMuscleKg, 'kg', delta('skeletalMuscleKg', 'kg')],
        ['체지방률', r.bodyFatPct, '%', delta('bodyFatPct', '%p')],
        ['체지방량', r.bodyFatKg, 'kg', delta('bodyFatKg', 'kg')],
    ];
    const extra = [
        r.score != null && `인바디 점수 ${r.score}`,
        r.visceralFatArea != null && `내장지방 ${r.visceralFatArea}cm²`,
        r.bmi != null && `BMI ${r.bmi}`,
        r.bmrKcal != null && `기초대사량 ${r.bmrKcal}kcal`,
        r.systolicBp != null && `혈압 ${r.systolicBp}${r.diastolicBp ? `/${r.diastolicBp}` : ''}`,
        r.pulse != null && `맥박 ${r.pulse}`,
    ].filter(Boolean);
    return (_jsxs(Card, { title: `최근 측정 · ${r.date}${r.time ? ` ${r.time}` : ''}`, children: [_jsx("div", { className: "grid grid-cols-2 gap-3", children: tiles.map(([label, v, unit, d]) => (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: label }), _jsx("div", { className: "text-xl font-bold tabular-nums", children: v != null ? `${v}${unit}` : '-' }), d && _jsxs("div", { className: "text-xs text-slate-500 tabular-nums", children: ["\uC9C0\uB09C\uBC88\uBCF4\uB2E4 ", d] })] }, label))) }), extra.length > 0 && (_jsx("div", { className: "mt-3 flex flex-wrap gap-1", children: extra.map((e) => (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums", children: e }, e))) }))] }));
}
function ManualEntry() {
    const [date, setDate] = useState(today);
    const [v, setV] = useState({ weightKg: '', skeletalMuscleKg: '', bodyFatPct: '', bodyFatKg: '' });
    const [msg, setMsg] = useState('');
    const fields = [
        ['weightKg', '체중(kg)'],
        ['skeletalMuscleKg', '골격근량(kg)'],
        ['bodyFatPct', '체지방률(%)'],
        ['bodyFatKg', '체지방량(kg)'],
    ];
    const num = (s) => (s.trim() ? Number(s) : undefined);
    const rec = { date, source: 'manual', weightKg: num(v.weightKg), skeletalMuscleKg: num(v.skeletalMuscleKg), bodyFatPct: num(v.bodyFatPct), bodyFatKg: num(v.bodyFatKg) };
    const valid = Object.values(v).some((x) => x.trim()) && Object.values(v).every((x) => !x.trim() || Number.isFinite(Number(x)));
    const warnings = valid ? checkRecord(rec) : [];
    return (_jsxs(Card, { title: "\uCE21\uC815\uAC12 \uC785\uB825", children: [_jsxs("label", { className: "block text-xs text-slate-500", children: ["\uCE21\uC815\uC77C", _jsx("input", { id: "inbody-date", type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" })] }), _jsx("div", { className: "mt-2 grid grid-cols-2 gap-2", children: fields.map(([k, label]) => (_jsxs("label", { className: "text-xs text-slate-500", children: [label, _jsx("input", { id: `inbody-${k}`, type: "number", inputMode: "decimal", step: "0.1", value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" })] }, k))) }), warnings.map((w) => (_jsxs("p", { className: "mt-2 text-xs text-amber-700", children: ["\u26A0\uFE0F ", w] }, w))), _jsx("button", { disabled: !valid, onClick: async () => {
                    await saveInBody([rec]);
                    setMsg(`${date} 측정값을 저장했습니다.`);
                    setV({ weightKg: '', skeletalMuscleKg: '', bodyFatPct: '', bodyFatKg: '' });
                }, className: "mt-3 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-40", children: "\uC800\uC7A5" }), msg && _jsx("p", { className: "mt-2 text-sm text-teal-700", children: msg })] }));
}
function PasteImport() {
    const [text, setText] = useState('');
    const [result, setResult] = useState();
    const [msg, setMsg] = useState('');
    return (_jsxs(Card, { title: "\uACB0\uACFC\uC9C0 \uAC12 \uBD99\uC5EC\uB123\uAE30", children: [_jsx("p", { className: "mb-2 text-sm text-slate-500", children: "\uACB0\uACFC\uC9C0 \uC0AC\uC9C4\uC744 Claude \uCC44\uD305\uC5D0 \uC62C\uB9AC\uBA74 \uC77D\uC740 \uAC12\uC744 \uC904 \uB2E8\uC704\uB85C \uB3CC\uB824 \uB4DC\uB9BD\uB2C8\uB2E4. \uADF8 \uB0B4\uC6A9\uC744 \uBCF5\uC0AC\uD574\uC11C \uC5EC\uAE30\uC5D0 \uBD99\uC5EC\uB123\uC73C\uC138\uC694." }), _jsx("textarea", { id: "inbody-paste", value: text, onChange: (e) => setText(e.target.value), placeholder: '2026-10-15,07:16,sheet,62.2,30.4,8.2,13.2,...', className: "h-28 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" }), _jsx("button", { onClick: () => {
                    setResult(parseInBodyCsv(text));
                    setMsg('');
                }, disabled: !text.trim(), className: "mt-2 w-full rounded-lg border border-teal-700 py-2 font-semibold text-teal-700 disabled:opacity-40", children: "\uC77D\uC5B4\uBCF4\uAE30" }), result && (_jsxs("div", { className: "mt-3 space-y-1 text-sm", children: [result.errors.map((e) => (_jsx("p", { className: "text-xs text-red-700", children: e }, e))), result.records.map((r) => (_jsxs("div", { className: "tabular-nums", children: [_jsx("span", { className: "font-semibold", children: r.date }), " ", _jsx("span", { className: "text-xs text-slate-500", children: SOURCE_LABEL[r.source] }), " \u00B7 ", r.weightKg ?? '-', "kg \u00B7 \uACE8\uACA9\uADFC ", r.skeletalMuscleKg ?? '-', " \u00B7 \uCCB4\uC9C0\uBC29 ", r.bodyFatPct ?? '-', "%", checkRecord(r).map((w) => (_jsxs("div", { className: "text-xs text-amber-700", children: ["\u26A0\uFE0F ", w] }, w)))] }, r.date + r.source))), result.records.length > 0 && (_jsxs("button", { onClick: async () => {
                            const s = await saveInBody(result.records);
                            setMsg(`저장했습니다. 새로 ${s.added}회, 기존 날짜 보완 ${s.updated}회.`);
                            setResult(undefined);
                            setText('');
                        }, className: "mt-2 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white", children: [result.records.length, "\uD68C \uC800\uC7A5"] }))] })), msg && _jsx("p", { className: "mt-2 text-sm text-teal-700", children: msg })] }));
}
const HISTORY_TAG = { history: '추이', manual: '입력', log: '기록' };
function History({ records }) {
    const [limit, setLimit] = useState(10);
    const rows = [...records].reverse();
    return (_jsxs(Card, { title: `측정 기록 (${records.length}회)`, children: [_jsxs("table", { className: "w-full text-sm tabular-nums", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs text-slate-500", children: [_jsx("th", { className: "font-normal", children: "\uB0A0\uC9DC" }), _jsx("th", { className: "text-right font-normal", children: "\uCCB4\uC911" }), _jsx("th", { className: "text-right font-normal", children: "\uACE8\uACA9\uADFC" }), _jsx("th", { className: "text-right font-normal", children: "\uCCB4\uC9C0\uBC29\uB960" }), _jsx("th", { className: "text-right font-normal", children: "\uD608\uC555" })] }) }), _jsx("tbody", { children: rows.slice(0, limit).map((r) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsxs("td", { className: "py-1.5", children: [r.date.slice(2).replaceAll('-', '.'), r.source !== 'sheet' && _jsx("span", { className: "ml-1 text-xs text-slate-400", children: HISTORY_TAG[r.source] })] }), _jsx("td", { className: "text-right", children: r.weightKg ?? '-' }), _jsx("td", { className: "text-right", children: r.skeletalMuscleKg ?? '-' }), _jsx("td", { className: "text-right", children: r.bodyFatPct ?? '-' }), _jsx("td", { className: "text-right", children: r.systolicBp ?? '-' })] }, r.date))) })] }), rows.length > limit && (_jsx("button", { onClick: () => setLimit(limit + 20), className: "mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm", children: "\uB354 \uBCF4\uAE30" }))] }));
}
function Card({ title, children }) {
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-3 font-semibold", children: title }), children] }));
}
