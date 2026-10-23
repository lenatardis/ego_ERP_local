// Keeps MSW mocking a page after the browser has stopped its idle service worker — ONE FILE, KEPT IDENTICAL IN BOTH
// REPOS (ego_ERP_local and ego_CRM_local, src/mocks/shared/; `check:shared` compares them). No bundler globals.
//
// Why: Chrome stops a service worker that has had nothing to do for ~30 s. MSW's page pings its worker every 5 s to
// prevent that, but timers are throttled in a hidden tab (say, while you work in another window), so the worker gets
// stopped. The restarted worker has forgotten which pages it mocks — it keeps them in memory (`activeClientIds` in
// public/mockServiceWorker.js) — and lets their API requests through to the static host: lists come back empty
// until the page is reloaded.
//
// keepMocking() (called once the mock backend has started):
//   - when the tab is shown or focused again, it tells the worker again that this page is mocked — the same
//     "MOCK_ACTIVATE" message MSW sends when it starts — which also wakes the worker up;
//   - as a fallback, an API request that still gets a non-JSON answer (every mock answers JSON, or 204 without a
//     body) shows a notice asking to reload the page.

const API_PATH = '/api/v1/'; // both apps' API paths contain it (ERP: /admin_panel/api/v1/..., CRM: /api/v1/...)
const NOTICE_ID = 'demo-msw-notice';
const NOTICE_TEXT = 'Вибачте, тестове демо працює на MSW (Mock Service Worker) і після паузи втратило з ним зв’язок. '
    + 'Перезавантажте сторінку, щоб завантажити дані.';

const reactivate = () => {
    try {
        navigator.serviceWorker?.controller?.postMessage('MOCK_ACTIVATE');
    } catch {
        // no worker to talk to
    }
};

const showReloadNotice = () => {
    if (document.getElementById(NOTICE_ID)) return;

    const notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, {
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: '16px',
        zIndex: '100000',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        maxWidth: '760px',
        margin: '0 auto',
        padding: '12px 16px',
        borderRadius: '8px',
        background: '#2F2038',
        color: '#FFFFFF',
        fontSize: '14px',
        lineHeight: '1.4',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    });

    const text = document.createElement('span');
    text.textContent = NOTICE_TEXT;
    text.style.flex = '1 1 260px';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Перезавантажити';
    Object.assign(button.style, {
        flex: 'none',
        padding: '8px 14px',
        border: 'none',
        borderRadius: '6px',
        background: '#FFFFFF',
        color: '#2F2038',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    });
    button.addEventListener('click', () => window.location.reload());

    notice.append(text, button);
    document.body.append(notice);
};

const isOwnApiRequest = (input) => {
    try {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
        return url.origin === window.location.origin && url.pathname.includes(API_PATH);
    } catch {
        return false;
    }
};

export const keepMocking = () => {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reactivate();
    });
    window.addEventListener('focus', reactivate);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        const contentType = response.headers.get('content-type') || '';
        if (isOwnApiRequest(input) && response.status !== 204 && !contentType.includes('json')) {
            reactivate();
            showReloadNotice();
        }
        return response;
    };
};
