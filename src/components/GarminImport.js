import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { db, saveGarmin } from '../db/db';
import { FIELD_LABELS, parseGarminCsv } from '../import/garminCsv';
import { mergeGarmin } from '../import/mergeGarmin';
const REQUIRED = ['date', 'type', 'distance'];
export default function GarminImport() {
    const [result, setResult] = useState();
    const [preview, setPreview] = useState();
    const [msg, setMsg] = useState('');
    const [saving, setSaving] = useState(false);
    const load = async (file) => {
        if (!file)
            return;
        setMsg('');
        const r = parseGarminCsv(await file.text());
        setResult(r);
        // dry run against what is stored, so the numbers below match what saving will do
        const dates = [...new Set(r.activities.map((a) => a.date))];
        const existing = (await db.days.bulkGet(dates)).filter((d) => !!d);
        setPreview(mergeGarmin(existing, r.activities, (date) => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] })).stats);
    };
    const save = async () => {
        if (!result)
            return;
        setSaving(true);
        try {
            const s = await saveGarmin(result.activities);
            setMsg(`저장했습니다. 기존 러닝에 합침 ${s.matched}개, 새 러닝 ${s.added}개, 다시 읽어 갱신 ${s.updated}개.`);
            setResult(undefined);
            setPreview(undefined);
        }
        catch (e) {
            setMsg(`저장하지 못했습니다: ${e instanceof Error ? e.message : e}`);
        }
        finally {
            setSaving(false);
        }
    };
    const missing = result ? REQUIRED.filter((f) => !result.columns[f]) : [];
    const acts = result?.activities ?? [];
    const count = (k) => acts.filter((a) => a.kind === k).length;
    const dates = acts.map((a) => a.date).sort();
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-1 font-semibold", children: "\uAC00\uBBFC \uAE30\uB85D \uAC00\uC838\uC624\uAE30" }), _jsxs("p", { className: "mb-3 text-sm text-slate-500", children: ["PC\uC5D0\uC11C \uAC00\uBBFC \uCEE4\uB125\uD2B8 \uC6F9 \u2192 \uD65C\uB3D9 \u2192 \uBAA9\uB85D \uC704\uC758 ", _jsx("b", { children: "CSV \uB0B4\uBCF4\uB0B4\uAE30" }), "\uB85C \uBC1B\uC740 \uD30C\uC77C\uC744 \uACE0\uB974\uC138\uC694. \uAC00\uBBFC \uAE30\uB85D\uC774 \uAE30\uC900\uC785\uB2C8\uB2E4. \uAC19\uC740 \uB0A0 \uAC19\uC740 \uB7EC\uB2DD\uC73C\uB85C \uBCF4\uC774\uB294 \uAE30\uB85D\uC740 \uAC70\uB9AC\u00B7\uC2DC\uAC04\uC744 \uAC00\uBBFC \uAC12\uC73C\uB85C \uBC14\uAFB8\uACE0 \uC7A5\uC18C\u00B7\uC8FC\uC81C\u00B7\uC2E0\uBC1C\u00B7\uBA54\uBAA8\uB294 \uADF8\uB300\uB85C \uB450\uBA70, \uC9DD\uC774 \uC5C6\uB294 \uAC00\uBBFC \uB7EC\uB2DD\uC740 \uC0C8\uB85C \uB123\uC2B5\uB2C8\uB2E4."] }), _jsxs("label", { className: "block cursor-pointer rounded-lg border border-teal-700 py-2 text-center font-semibold text-teal-700", children: ["CSV \uD30C\uC77C \uC120\uD0DD", _jsx("input", { id: "garmin-file", type: "file", accept: ".csv,text/csv", className: "hidden", onChange: (e) => load(e.target.files?.[0]) })] }), result && (_jsxs("div", { className: "mt-3 space-y-3 text-sm", children: [missing.length > 0 ? (_jsxs("p", { className: "rounded-lg bg-amber-50 p-2 text-amber-800", children: [missing.map((f) => FIELD_LABELS[f]).join(', '), " \uC5F4\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD30C\uC77C \uCCAB \uC904(\uC5F4 \uC774\uB984)\uC744 \uC54C\uB824\uC8FC\uC2DC\uBA74 \uB9DE\uCDB0 \uB4DC\uB9B4\uAC8C\uC694."] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "tabular-nums", children: [dates[0], " ~ ", dates.at(-1), " \u00B7 \uD65C\uB3D9 ", acts.length, "\uAC1C (\uB7EC\uB2DD ", count('run'), ", \uAC77\uAE30 ", count('walk'), ", \uADFC\uB825 ", count('strength'), ", \uAE30\uD0C0 ", count('other'), ")"] }), acts.some((a) => a.convertedFrom) && (_jsxs("p", { className: "text-xs text-slate-500", children: ["\uBBF8\uD130\u00B7\uB9C8\uC77C\uB85C \uC801\uD78C \uAC70\uB9AC ", acts.filter((a) => a.convertedFrom).length, "\uAC1C\uB97C km\uB85C \uBC14\uAFD4 \uC77D\uC5C8\uC2B5\uB2C8\uB2E4."] })), preview && (_jsxs("p", { className: "tabular-nums text-slate-600", children: ["\uC800\uC7A5\uD558\uBA74: \uAE30\uC874 \uB7EC\uB2DD\uC5D0 \uD569\uCE68 ", preview.matched, " \u00B7 \uC0C8 \uB7EC\uB2DD ", preview.added, " \u00B7 \uC774\uBBF8 \uAC00\uC838\uC628 \uD65C\uB3D9 \uAC31\uC2E0 ", preview.updated, " \u00B7 \uC6E8\uC774\uD2B8 \uD45C\uC2DC", ' ', preview.strengthDays, "\uC77C \u00B7 \uAC74\uB108\uB700 ", preview.ignored] }))] })), _jsxs("details", { className: "text-xs text-slate-500", children: [_jsx("summary", { children: "\uC54C\uC544\uBCF8 \uC5F4" }), _jsx("ul", { className: "mt-1 grid grid-cols-2 gap-x-2", children: Object.entries(FIELD_LABELS).map(([f, label]) => (_jsxs("li", { children: [result.columns[f] ? '✓' : '–', " ", label] }, f))) })] }), _jsx("button", { onClick: save, disabled: saving || missing.length > 0 || !acts.length, className: "w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40", children: saving ? '저장하는 중…' : '합쳐서 저장' })] })), msg && _jsx("p", { className: "mt-2 text-sm text-teal-700", children: msg })] }));
}
