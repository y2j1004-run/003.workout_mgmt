import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const tabs = [
    { id: 'home', icon: '🏠', label: '홈' },
    { id: 'workout', icon: '💪', label: '운동' },
    { id: 'inbody', icon: '⚖️', label: '인바디' },
    { id: 'stats', icon: '📊', label: '통계' },
    { id: 'settings', icon: '⚙️', label: '설정' },
];
export default function TabBar({ current, onChange, badge }) {
    return (_jsx("nav", { className: "grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]", children: tabs.map((t) => (_jsxs("button", { onClick: () => onChange(t.id), className: `flex flex-col items-center gap-0.5 py-2 text-xs ${current === t.id ? 'font-semibold text-teal-700' : 'text-slate-500'}`, children: [_jsxs("span", { className: "relative text-xl", children: [t.icon, badge === t.id && _jsx("span", { className: "absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-amber-500", "aria-label": "\uD655\uC778 \uD544\uC694" })] }), t.label] }, t.id))) }));
}
