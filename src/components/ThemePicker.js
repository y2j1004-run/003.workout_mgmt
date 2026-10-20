import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { THEMES } from '../analytics/themes';
// One-tap theme chips plus a field for any other theme; tapping the chosen chip clears it.
export default function ThemePicker({ id, value, onPick }) {
    const [custom, setCustom] = useState(value && !THEMES.includes(value) ? value : '');
    const chip = (active) => `rounded-full border px-3 py-1 text-xs ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`;
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [THEMES.map((t) => (_jsx("button", { type: "button", onClick: () => onPick(value === t ? undefined : t), className: chip(value === t), children: t }, t))), _jsx("input", { id: `${id}-custom`, value: custom, onChange: (e) => {
                    setCustom(e.target.value);
                    onPick(e.target.value.trim() || undefined);
                }, placeholder: "\uC9C1\uC811 \uC785\uB825", className: `w-24 rounded-full border px-3 py-1 text-xs ${custom && value === custom.trim() ? 'border-teal-700' : 'border-slate-300'}` })] }));
}
