import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import BackupRestore from '../components/BackupRestore';
import GarminImport from '../components/GarminImport';
import ImportLog from '../components/ImportLog';
import GoalsCard from '../components/GoalsCard';
export default function Settings() {
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uC124\uC815" }), _jsx(ImportLog, {}), _jsx(GarminImport, {}), _jsx(BackupRestore, {}), _jsx(GoalsCard, {}), _jsxs("p", { className: "text-center text-xs text-slate-400 tabular-nums", children: ["\uC571 \uBC84\uC804 ", new Date(__BUILD_TIME__).toLocaleString('ko-KR')] })] }));
}
