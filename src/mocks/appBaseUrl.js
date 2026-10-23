// Base URL of this app (Vite `base`, '/ego_ERP_local/' on GitHub Pages), with a trailing slash.
// The catalog seed shared with the CRM (shared/catalog/) builds demo media URLs from it; the CRM has its own
// version of this file, so the shared files themselves stay identical and free of bundler globals.
export const APP_BASE_URL = import.meta.env.BASE_URL;
