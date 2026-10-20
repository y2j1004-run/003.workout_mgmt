import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BACKUP_REMIND_DAYS, daysSince } from './components/BackupRestore';
import { lastBackupAt } from './db/backup';
import { db } from './db/db';
import TabBar from './components/TabBar';
import UpdateBanner from './components/UpdateBanner';
import Home from './pages/Home';
import Workout from './pages/Workout';
import InBody from './pages/InBody';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
const pages = {
    home: Home,
    workout: Workout,
    inbody: InBody,
    stats: Stats,
    settings: Settings,
};
export default function App() {
    const [tab, setTab] = useState('home');
    const Page = pages[tab];
    // a dot on 설정 while there is data that hasn't been backed up for a week
    const backupDue = useLiveQuery(async () => {
        if (!(await db.days.count()))
            return false;
        const age = daysSince(await lastBackupAt());
        return age == null || age >= BACKUP_REMIND_DAYS;
    });
    return (_jsxs("div", { className: "mx-auto flex h-full max-w-md flex-col", children: [_jsx(UpdateBanner, {}), _jsx("main", { className: "flex-1 overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4", children: _jsx(Page, {}) }), _jsx(TabBar, { current: tab, onChange: setTab, badge: backupDue ? 'settings' : undefined })] }));
}
