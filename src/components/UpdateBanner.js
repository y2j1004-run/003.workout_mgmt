import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRegisterSW } from 'virtual:pwa-register/react';
const CHECK_EVERY_MS = 60 * 60 * 1000;
// Shows a bar when a new version has been downloaded; tapping it switches to the new version.
export default function UpdateBanner() {
    const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker, } = useRegisterSW({
        onRegisteredSW(_url, registration) {
            if (!registration)
                return;
            // the app can stay open for days, so look for a new version now and then and whenever it comes back to the screen
            setInterval(() => registration.update(), CHECK_EVERY_MS);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible')
                    registration.update();
            });
        },
    });
    if (!needRefresh)
        return null;
    return (_jsxs("div", { className: "flex items-center gap-2 bg-teal-700 px-4 py-2 text-sm text-white", children: [_jsx("span", { className: "flex-1", children: "\uC0C8 \uBC84\uC804\uC774 \uC788\uC2B5\uB2C8\uB2E4." }), _jsx("button", { onClick: () => setNeedRefresh(false), className: "px-2 py-1 text-teal-100", children: "\uB098\uC911\uC5D0" }), _jsx("button", { onClick: () => updateServiceWorker(true), className: "rounded-lg bg-white px-3 py-1 font-semibold text-teal-800", children: "\uC9C0\uAE08 \uC801\uC6A9" })] }));
}
