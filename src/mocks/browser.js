// Mock backend for the portfolio build: the original API is unavailable, so requests made by
// src/api/* are answered in the browser by MSW (Mock Service Worker) using the handlers below.
// Requests without a handler are reported in the console and are not mocked.
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export const startMockBackend = () =>
    worker.start({
        // BASE_URL keeps the worker reachable when the app is served from a sub-path (e.g. GitHub Pages)
        serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
        // only API calls are worth a warning (page navigations, Vite modules etc. pass through silently)
        onUnhandledFrame({ frame, defaults }) {
            const path = frame.request ? new URL(frame.request.url).pathname : '';
            if (path.includes('/api/v1/')) defaults.warn();
        },
    });
