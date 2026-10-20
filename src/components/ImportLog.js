import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { fmtTime } from '../analytics/stats';
import { clearDays, db, saveDays } from '../db/db';
import { parseLog } from '../import/parseLog';
const PAGE = 40;
export default function ImportLog() {
    const [text, setText] = useState('');
    const [result, setResult] = useState();
    const [onlyIssues, setOnlyIssues] = useState(false);
    const [shown, setShown] = useState(PAGE);
    const [saveMsg, setSaveMsg] = useState('');
    const [saving, setSaving] = useState(false);
    const read = (content) => {
        setResult(parseLog(content));
        setShown(PAGE);
        setSaveMsg('');
    };
    const loadFile = async (file) => {
        if (!file)
            return;
        const content = await file.text();
        setText(content);
        read(content);
    };
    const updateDay = (date, change) => setResult((r) => r && { ...r, days: r.days.map((d) => (d.date === date ? change(d) : d)) });
    const save = async () => {
        if (!result)
            return;
        setSaving(true);
        try {
            const { added, replaced } = await saveDays(result.days);
            setSaveMsg(`저장했습니다. 새로 ${added}일${replaced ? `, 기존 ${replaced}일은 새 내용으로 바꿈` : ''}.`);
        }
        catch (e) {
            setSaveMsg(`저장하지 못했습니다: ${e instanceof Error ? e.message : e}`);
        }
        finally {
            setSaving(false);
        }
    };
    const days = result ? [...result.days].reverse().filter((d) => !onlyIssues || needsReview(d)) : [];
    return (_jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-1 font-semibold", children: "\uC6B4\uB3D9 \uAE30\uB85D \uAC00\uC838\uC624\uAE30" }), _jsx("p", { className: "mb-3 text-sm text-slate-500", children: "\uBA54\uBAA8\uC7A5 \uAE30\uB85D\uC744 \uBD99\uC5EC\uB123\uAC70\uB098 .txt \uD30C\uC77C\uC744 \uACE0\uB974\uBA74, \uB0A0\uC9DC\uBCC4\uB85C \uC5B4\uB5BB\uAC8C \uC77D\uC5C8\uB294\uC9C0 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4." }), _jsx("textarea", { id: "log-text", value: text, onChange: (e) => setText(e.target.value), placeholder: '[ 2025년 ]\n03.21 : 5키로 러닝, 웨이트, 체지방률 17.2', className: "h-40 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { onClick: () => read(text), disabled: !text.trim(), className: "flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40", children: "\uC77D\uC5B4\uBCF4\uAE30" }), _jsxs("label", { className: "flex-1 cursor-pointer rounded-lg border border-teal-700 py-2 text-center font-semibold text-teal-700", children: ["\uD30C\uC77C \uC120\uD0DD", _jsx("input", { id: "log-file", type: "file", accept: ".txt,text/plain", className: "hidden", onChange: (e) => loadFile(e.target.files?.[0]) })] })] })] }), result && _jsx(Summary, { days: result.days }), result && (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("button", { onClick: save, disabled: saving || !result.days.length, className: "w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40", children: saving ? '저장하는 중…' : `${result.days.length}일 기록 저장하기` }), _jsx("p", { className: "mt-2 text-xs text-slate-500", children: saveMsg ||
                            `노란 테두리 날은 저장 전에 고칠 수 있습니다 (${result.days.filter(needsReview).length}일). 이미 저장된 날짜는 새 내용으로 바뀝니다.` })] })), result && (_jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { id: "only-issues", type: "checkbox", checked: onlyIssues, onChange: (e) => setOnlyIssues(e.target.checked) }), "\uD655\uC778\uC774 \uD544\uC694\uD55C \uB0A0\uB9CC \uBCF4\uAE30 (", result.days.filter(needsReview).length, "\uC77C)"] }), days.slice(0, shown).map((d) => (_jsx(DayCard, { day: d, onChange: (change) => updateDay(d.date, change) }, d.date))), days.length > shown && (_jsxs("button", { onClick: () => setShown(shown + PAGE), className: "w-full rounded-lg bg-slate-200 py-2 text-sm", children: ["\uB354 \uBCF4\uAE30 (", days.length - shown, "\uC77C \uB0A8\uC74C)"] }))] })), _jsx(SavedData, {})] }));
}
function SavedData() {
    const count = useLiveQuery(() => db.days.count());
    const [confirming, setConfirming] = useState(false);
    if (!count)
        return null;
    return (_jsxs("div", { className: "flex items-center justify-between rounded-xl bg-white p-4 text-sm shadow-sm", children: [_jsxs("span", { children: ["\uD734\uB300\uD3F0\uC5D0 \uC800\uC7A5\uB41C \uAE30\uB85D ", _jsxs("b", { className: "tabular-nums", children: [count, "\uC77C"] })] }), confirming ? (_jsxs("span", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setConfirming(false), className: "rounded-lg bg-slate-200 px-3 py-1", children: "\uCDE8\uC18C" }), _jsx("button", { onClick: async () => {
                            await clearDays();
                            setConfirming(false);
                        }, className: "rounded-lg bg-red-600 px-3 py-1 font-semibold text-white", children: "\uBAA8\uB450 \uC9C0\uC6B0\uAE30" })] })) : (_jsx("button", { onClick: () => setConfirming(true), className: "text-red-600", children: "\uC9C0\uC6B0\uAE30\u2026" }))] }));
}
function needsReview(d) {
    return d.issues.length > 0 || (d.activities.length === 0 && !d.rest && !d.strength);
}
function Summary({ days }) {
    const acts = days.flatMap((d) => d.activities);
    const runs = acts.filter((a) => a.kind === 'run');
    const km = (list) => list.reduce((s, a) => s + a.distanceKm, 0);
    const stats = [
        ['기간', days.length ? `${days[0].date} ~ ${days.at(-1).date}` : '-'],
        ['기록한 날', `${days.length}일`],
        ['러닝', `${runs.length}회 · ${km(runs).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`],
        ['걷기', `${acts.length - runs.length}회 · ${km(acts.filter((a) => a.kind === 'walk')).toFixed(1)}km`],
        ['웨이트', `${days.filter((d) => d.strength?.done).length}일`],
        ['체지방률 측정', `${days.filter((d) => d.metrics.bodyFatPct).length}회`],
        ['혈압 기록', `${days.filter((d) => d.metrics.systolicBp).length}회`],
        ['공복 기록', `${days.filter((d) => d.fastingHours).length}일`],
    ];
    return (_jsx("div", { className: "grid grid-cols-2 gap-2 rounded-xl bg-white p-4 shadow-sm", children: stats.map(([label, value]) => (_jsxs("div", { className: label === '기간' ? 'col-span-2' : '', children: [_jsx("div", { className: "text-xs text-slate-500", children: label }), _jsx("div", { className: "font-semibold tabular-nums", children: value })] }, label))) }));
}
function DayCard({ day, onChange }) {
    const [open, setOpen] = useState(false);
    const [addKm, setAddKm] = useState('');
    const review = needsReview(day);
    const addRun = () => {
        const km = Number(addKm);
        if (!(km > 0))
            return;
        onChange((d) => ({
            ...d,
            activities: [...d.activities, { kind: 'run', distanceKm: km, companions: [], details: [], tags: ['직접 입력'] }],
            issues: [],
        }));
        setAddKm('');
    };
    const m = day.metrics;
    const chips = [
        day.strength && (day.strength.done ? `웨이트${day.strength.parts.length ? ` (${day.strength.parts.join(', ')})` : ''}` : '웨이트 못함'),
        day.fastingHours && `공복 ${day.fastingHours}시간`,
        m.bodyFatPct && `체지방률 ${m.bodyFatPct}%`,
        m.systolicBp && `혈압(수축기) ${m.systolicBp}`,
        m.weightKg && `체중 ${m.weightKg}kg`,
        m.vo2max && `VO2max ${m.vo2max}`,
        m.heartRate && `심박수 ${m.heartRate}`,
        day.meals && `${day.meals}식`,
        day.stretching && '스트레칭',
        day.rest && '휴식',
    ].filter(Boolean);
    return (_jsxs("div", { className: `rounded-xl bg-white p-3 shadow-sm ${needsReview(day) ? 'ring-2 ring-amber-400' : ''}`, children: [_jsxs("button", { onClick: () => setOpen(!open), className: "flex w-full items-baseline justify-between text-left", children: [_jsx("span", { className: "font-semibold tabular-nums", children: day.date }), _jsx("span", { className: "text-xs text-slate-400", children: open ? '원문 닫기' : '원문 보기' })] }), day.activities.map((a, i) => (_jsxs("div", { className: "mt-1 text-sm", children: [_jsxs("span", { className: "font-semibold text-teal-700 tabular-nums", children: [a.kind === 'walk' ? '걷기' : '러닝', " ", a.distanceKm, "km"] }), a.durationSec ? _jsxs("span", { className: "tabular-nums", children: [" \u00B7 ", fmtTime(a.durationSec)] }) : null, a.paceSecPerKm ? _jsxs("span", { className: "tabular-nums", children: [" \u00B7 ", fmtTime(a.paceSecPerKm), "/km"] }) : null, a.raceDistanceKm ? _jsxs("span", { className: "tabular-nums", children: [" (\uB300\uD68C ", a.raceDistanceKm, "km)"] }) : null, a.event && _jsxs("span", { children: [" \u00B7 \uD83C\uDFC1 ", a.event] }), a.crew && _jsxs("span", { children: [" \u00B7 \uD83C\uDFC3 ", a.crew, " \uD06C\uB8E8"] }), a.place && _jsxs("span", { children: [" \u00B7 \uD83D\uDCCD ", a.place] }), a.companions.length > 0 && _jsxs("span", { children: [" \u00B7 \uD83D\uDC65 ", a.companions.join(', ')] }), a.shoe && _jsxs("span", { children: [" \u00B7 \uD83D\uDC5F ", a.shoe] }), a.details.length > 0 && _jsxs("div", { className: "text-xs text-slate-600", children: ["\uD6C8\uB828: ", a.details.join(' / ')] }), a.tags.length > 0 && _jsxs("div", { className: "text-xs text-slate-500", children: ["\uAE30\uD0C0: ", a.tags.join(', ')] })] }, i))), chips.length > 0 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1", children: chips.map((c) => (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-xs", children: c }, c))) })), day.notes.map((n, i) => (_jsxs("p", { className: "mt-1 text-xs text-slate-600", children: ["\uD83D\uDCDD ", n] }, i))), day.issues.map((n, i) => (_jsxs("p", { className: "mt-1 text-xs text-amber-700", children: ["\u26A0\uFE0F ", n] }, i))), review && (_jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-sm", children: [_jsx("input", { id: `add-km-${day.date}`, type: "number", inputMode: "decimal", step: "0.1", value: addKm, onChange: (e) => setAddKm(e.target.value), placeholder: "\uAC70\uB9AC(km)", className: "w-24 rounded-lg border border-slate-300 px-2 py-1" }), _jsx("button", { onClick: addRun, className: "rounded-lg bg-teal-700 px-3 py-1 text-white", children: "\uB7EC\uB2DD \uCD94\uAC00" }), _jsx("button", { onClick: () => onChange((d) => ({ ...d, issues: [], rest: d.activities.length ? d.rest : true })), className: "rounded-lg bg-slate-200 px-3 py-1", children: "\uC774\uB300\uB85C \uAD1C\uCC2E\uC74C" })] })), open && _jsx("pre", { className: "mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap", children: day.raw.join('\n') })] }));
}
