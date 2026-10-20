import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getGoals, setGoals } from '../db/goals';
const FIELDS = [
    ['weeklyKm', '주간 러닝 거리', 'km'],
    ['monthlyKm', '월간 러닝 거리', 'km'],
    ['yearlyKm', '연간 러닝 거리', 'km'],
    ['bodyFatPct', '목표 체지방률', '%'],
    ['weightKg', '목표 체중', 'kg'],
];
export default function GoalsCard() {
    const saved = useLiveQuery(getGoals);
    const [form, setForm] = useState({});
    const [msg, setMsg] = useState('');
    useEffect(() => {
        if (saved)
            setForm(Object.fromEntries(FIELDS.map(([k]) => [k, saved[k] != null ? String(saved[k]) : ''])));
    }, [saved]);
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-1 font-semibold", children: "\uBAA9\uD45C \uC124\uC815" }), _jsx("p", { className: "mb-3 text-sm text-slate-500", children: "\uC815\uD55C \uBAA9\uD45C\uB294 \uD648 \uD654\uBA74\uC5D0 \uC9C4\uD589\uB960\uB85C \uB098\uC635\uB2C8\uB2E4. \uBE44\uC6CC \uB450\uBA74 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: FIELDS.map(([k, label, unit]) => (_jsxs("label", { className: "text-xs text-slate-500", children: [label, " (", unit, ")", _jsx("input", { id: `goal-${k}`, type: "number", inputMode: "decimal", step: "0.1", min: "0", value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }), className: "mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" })] }, k))) }), _jsx("button", { onClick: async () => {
                    const goals = {};
                    for (const [k] of FIELDS)
                        if (Number(form[k]) > 0)
                            goals[k] = Number(form[k]);
                    await setGoals(goals);
                    setMsg('목표를 저장했습니다.');
                }, className: "mt-3 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white", children: "\uC800\uC7A5" }), msg && _jsx("p", { className: "mt-2 text-sm text-teal-700", children: msg })] }));
}
