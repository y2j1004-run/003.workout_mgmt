import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
// Chips for the shoes in rotation, plus a field to type a new one.
export default function ShoePicker({ id, options, value, onPick, allowNone }) {
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const chip = (active) => `rounded-full border px-3 py-1.5 text-sm ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`;
    const addNew = () => {
        const n = name.trim();
        if (!n)
            return;
        onPick(n);
        setName('');
        setAdding(false);
    };
    return (_jsxs("div", { className: "flex flex-wrap gap-2", children: [options.map((o) => (_jsx("button", { type: "button", onClick: () => onPick(o), className: chip(o === value), children: o }, o))), value && !options.includes(value) && (_jsx("button", { type: "button", className: chip(true), children: value })), allowNone && (_jsx("button", { type: "button", onClick: () => onPick(undefined), className: chip(!value), children: "\uC2E0\uBC1C \uC5C6\uC74C" })), adding ? (_jsxs("span", { className: "flex gap-1", children: [_jsx("input", { id: `${id}-new`, autoFocus: true, value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => e.key === 'Enter' && addNew(), placeholder: "\uC2E0\uBC1C \uC774\uB984", className: "w-28 rounded-full border border-slate-300 px-3 py-1 text-sm" }), _jsx("button", { type: "button", onClick: addNew, className: "rounded-full bg-teal-700 px-3 text-sm text-white", children: "\uCD94\uAC00" })] })) : (_jsx("button", { type: "button", onClick: () => setAdding(true), className: "rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-600", children: "+ \uC0C8 \uC2E0\uBC1C" }))] }));
}
