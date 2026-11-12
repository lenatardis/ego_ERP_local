// Demo build: reload a tab that runs an outdated bundle (same as the CRM's src/utils/versionCheck.js). A phone kept
// an old copy of the CRM after a deploy and hung until its cache was cleared (2026-11-13). The deploy workflow writes
// the commit it built into the bundle (VITE_BUILD_ID) and into `version.json` next to index.html. When the app starts,
// and again whenever its tab is shown (at most once a minute), it asks for `version.json`, bypassing every cache. If
// the deployed build is different, it reloads once. A reload revalidates index.html, so it gets the new bundle.
// Local builds have no build id, so they skip the check.

const BUILD_ID = import.meta.env.VITE_BUILD_ID;
const RELOADED_KEY = 'ego-demo:erp:reloadedForBuild';
const MIN_INTERVAL_MS = 60 * 1000;

let lastCheck = 0;

const readReloaded = () => {
    try {
        return sessionStorage.getItem(RELOADED_KEY);
    } catch {
        return null;
    }
};

const check = async () => {
    lastCheck = Date.now();
    try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (!build || build === BUILD_ID) return;
        // Reload only once per new build: if the CDN still serves the old index.html for a while, a reload loop
        // is worse than an old bundle.
        if (readReloaded() === build) return;
        try {
            sessionStorage.setItem(RELOADED_KEY, build);
        } catch {
            return; // without the guard, a reload could repeat
        }
        window.location.reload();
    } catch {
        // offline or no version.json: keep the running bundle
    }
};

export const startVersionCheck = () => {
    if (!BUILD_ID) return;
    check();
    const onShow = () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck >= MIN_INTERVAL_MS) check();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
};
