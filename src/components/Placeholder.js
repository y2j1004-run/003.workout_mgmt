import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Placeholder({ title, items }) {
    return (_jsxs("section", { children: [title && _jsx("h1", { className: "mb-4 text-2xl font-bold", children: title }), _jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("p", { className: "mb-2 text-sm text-slate-500", children: "\uC900\uBE44 \uC911\uC778 \uAE30\uB2A5" }), _jsx("ul", { className: "list-disc space-y-1 pl-5 text-sm", children: items.map((item) => (_jsx("li", { children: item }, item))) })] })] }));
}
