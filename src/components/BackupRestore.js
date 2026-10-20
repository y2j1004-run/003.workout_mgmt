import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { backupFileName, createBackup, lastBackupAt, markBackedUp, readBackup, restoreBackup } from '../db/backup';
import { db } from '../db/db';
export const BACKUP_REMIND_DAYS = 7;
export function daysSince(iso, now = Date.now()) {
    return iso ? Math.floor((now - Date.parse(iso)) / 86_400_000) : undefined;
}
export default function BackupRestore() {
    const last = useLiveQuery(lastBackupAt);
    const count = useLiveQuery(() => db.days.count());
    const [msg, setMsg] = useState('');
    const [pending, setPending] = useState();
    const [confirmReplace, setConfirmReplace] = useState(false);
    const age = daysSince(last);
    const overdue = !!count && (age == null || age >= BACKUP_REMIND_DAYS);
    const makeFile = async () => {
        const b = await createBackup();
        return new File([JSON.stringify(b)], backupFileName(b), { type: 'application/json' });
    };
    const share = async () => {
        const file = await makeFile();
        try {
            await navigator.share({ files: [file], title: file.name });
            await markBackedUp();
            setMsg('공유했습니다. 저장한 곳(예: Google Drive)을 기억해 두세요.');
        }
        catch (e) {
            if (e.name !== 'AbortError')
                setMsg('공유하지 못했습니다. "파일로 저장"을 써 보세요.');
        }
    };
    const download = async () => {
        const file = await makeFile();
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        await markBackedUp();
        setMsg(`${file.name} 파일을 다운로드 폴더에 저장했습니다.`);
    };
    const pick = async (file) => {
        if (!file)
            return;
        setMsg('');
        setConfirmReplace(false);
        try {
            setPending(readBackup(JSON.parse(await file.text())));
        }
        catch (e) {
            setPending(undefined);
            setMsg(e instanceof SyntaxError ? '백업 파일을 읽지 못했습니다.' : e.message);
        }
    };
    const restore = async (mode) => {
        if (!pending)
            return;
        const r = await restoreBackup(pending, mode);
        setMsg(`복원했습니다. 기록 ${r.days}일, 신발 ${r.shoes}켤레, 인바디 ${r.inbody}회.`);
        setPending(undefined);
        setConfirmReplace(false);
    };
    const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
    return (_jsxs("div", { className: "rounded-xl bg-white p-4 shadow-sm", children: [_jsx("h2", { className: "mb-1 font-semibold", children: "\uBC31\uC5C5 \u00B7 \uBCF5\uC6D0" }), _jsxs("p", { className: `mb-3 text-sm ${overdue ? 'text-amber-700' : 'text-slate-500'}`, children: [last ? `마지막 백업: ${last.slice(0, 10)} (${age === 0 ? '오늘' : `${age}일 전`})` : '아직 백업한 적이 없습니다.', overdue && ' 기기를 바꾸거나 앱을 지우면 기록이 사라지니 백업해 두세요.'] }), _jsxs("div", { className: "flex gap-2", children: [canShare && (_jsx("button", { onClick: share, disabled: !count, className: "flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40", children: "Drive \uB4F1\uC5D0 \uC800\uC7A5" })), _jsx("button", { onClick: download, disabled: !count, className: `flex-1 rounded-lg py-2 font-semibold disabled:opacity-40 ${canShare ? 'border border-teal-700 text-teal-700' : 'bg-teal-700 text-white'}`, children: "\uD30C\uC77C\uB85C \uC800\uC7A5" })] }), _jsxs("label", { className: "mt-3 block cursor-pointer rounded-lg border border-slate-300 py-2 text-center text-sm text-slate-700", children: ["\uBC31\uC5C5 \uD30C\uC77C\uC5D0\uC11C \uBCF5\uC6D0", _jsx("input", { id: "restore-file", type: "file", accept: ".json,application/json", className: "hidden", onChange: (e) => pick(e.target.files?.[0]) })] }), pending && (_jsxs("div", { className: "mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm", children: [_jsxs("p", { className: "tabular-nums", children: [pending.exportedAt.slice(0, 10), "\uC5D0 \uB9CC\uB4E0 \uBC31\uC5C5 \u00B7 \uAE30\uB85D ", pending.days.length, "\uC77C \u00B7 \uC2E0\uBC1C ", pending.shoes.length, "\uCF24\uB808 \u00B7 \uC778\uBC14\uB514 ", pending.inbody?.length ?? 0, "\uD68C"] }), _jsx("button", { onClick: () => restore('merge'), className: "w-full rounded-lg bg-teal-700 py-2 font-semibold text-white", children: "\uC9C0\uAE08 \uAE30\uB85D\uC5D0 \uD569\uCE58\uAE30" }), _jsx("p", { className: "text-xs text-slate-500", children: "\uAC19\uC740 \uB0A0\uC9DC\uB294 \uB354 \uB098\uC911\uC5D0 \uC800\uC7A5\uB41C \uCABD\uC744 \uB0A8\uAE41\uB2C8\uB2E4." }), confirmReplace ? (_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setConfirmReplace(false), className: "flex-1 rounded-lg bg-slate-200 py-2", children: "\uCDE8\uC18C" }), _jsx("button", { onClick: () => restore('replace'), className: "flex-1 rounded-lg bg-red-600 py-2 font-semibold text-white", children: "\uC9C0\uC6B0\uACE0 \uBC14\uAFB8\uAE30" })] })) : (_jsx("button", { onClick: () => setConfirmReplace(true), className: "w-full rounded-lg border border-red-300 py-2 text-red-700", children: "\uC9C0\uAE08 \uAE30\uB85D\uC744 \uBAA8\uB450 \uC9C0\uC6B0\uACE0 \uBC31\uC5C5\uC73C\uB85C \uBC14\uAFB8\uAE30\u2026" }))] })), msg && _jsx("p", { className: "mt-2 text-sm text-teal-700", children: msg })] }));
}
