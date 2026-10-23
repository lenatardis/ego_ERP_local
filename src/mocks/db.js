// Tiny "database" behind the mock backend (MSW handlers).
//
// Each collection starts from its seed data. A collection is written to localStorage only after
// a handler changes it, so read-only collections are always served straight from the seed and
// changed ones survive page reloads. Everything stays in the visitor's own browser.
//
// Keys are namespaced because the CRM demo runs on the same github.io origin and shares one localStorage
// (see ../../CLAUDE.md, "Cross-app contract"). Two stores:
//   - ERP-private collections under `ego-demo:erp:*`;
//   - collections shared with the CRM (orders, customers, payment bills) under `ego-demo:shared:*`.
//     Their seed is identical in both apps, so whichever app writes first, the other reads the same data.
//     Shared collections are re-read from localStorage on every access: the CRM may change them in another tab.

const PREFIX = 'ego-demo:erp:';
const VERSION_KEY = `${PREFIX}version`;

// Bump when seed data or record shapes change: previously stored demo data is then discarded.
const DATA_VERSION = 35;
// Bump together with the CRM (same value in both repos) when shared seed data or record shapes change.
const SHARED_DATA_VERSION = 4;

// localStorage can be unavailable (blocked storage, some private modes): fall back to memory only.
const storage = {
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('[demo db] Could not persist demo data:', error);
        }
    },
    removeAllDemoKeys(prefix = PREFIX) {
        try {
            Object.keys(localStorage)
                .filter((key) => key.startsWith(prefix))
                .forEach((key) => localStorage.removeItem(key));
        } catch {
            // nothing stored, nothing to remove
        }
    },
};

if (storage.get(VERSION_KEY) !== String(DATA_VERSION)) {
    storage.removeAllDemoKeys();
    storage.set(VERSION_KEY, String(DATA_VERSION));
}

const cache = {};

/** Returns the live collection: stored state if this browser has one, otherwise a fresh copy of the seed. */
export const getCollection = (name, seed) => {
    if (!(name in cache)) {
        let stored = null;
        try {
            stored = JSON.parse(storage.get(PREFIX + name));
        } catch {
            stored = null;
        }
        cache[name] = stored ?? structuredClone(seed);
    }
    return cache[name];
};

/** Persists a collection after a handler has changed it. */
export const saveCollection = (name) => {
    if (name in cache) {
        storage.set(PREFIX + name, JSON.stringify(cache[name]));
    }
};

// --- collections shared with the CRM ---------------------------------------------------------

const SHARED_PREFIX = 'ego-demo:shared:';

if (storage.get(`${SHARED_PREFIX}version`) !== String(SHARED_DATA_VERSION)) {
    storage.removeAllDemoKeys(SHARED_PREFIX);
    storage.set(`${SHARED_PREFIX}version`, String(SHARED_DATA_VERSION));
}

// Private data follows the shared data it was built on (manufacturing orders and Privat payment links point at shared
// orders and bills): whenever the shared store is (re)created it gets a new generation id — here or in the CRM — and
// private data built on another generation is dropped. Private data that has no generation yet (stored before this
// check existed) adopts the current one.
const SHARED_GENERATION_KEY = `${SHARED_PREFIX}generation`;
const BUILT_ON_KEY = `${PREFIX}sharedGeneration`;
if (!storage.get(SHARED_GENERATION_KEY)) {
    storage.set(SHARED_GENERATION_KEY, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
}
const sharedGeneration = storage.get(SHARED_GENERATION_KEY);
const builtOn = storage.get(BUILT_ON_KEY);
if (builtOn && sharedGeneration && builtOn !== sharedGeneration) {
    storage.removeAllDemoKeys();
    storage.set(VERSION_KEY, String(DATA_VERSION));
    Object.keys(cache).forEach((name) => delete cache[name]);
}
if (sharedGeneration) storage.set(BUILT_ON_KEY, sharedGeneration);

const readJson = (key) => {
    try {
        return JSON.parse(storage.get(key));
    } catch {
        return null;
    }
};

/** A fresh copy of a shared collection (stored state, otherwise the seed); change it, then saveSharedCollection. */
export const getSharedCollection = (name, seed) => readJson(SHARED_PREFIX + name) ?? structuredClone(seed);

/** Persists a shared collection after a handler has changed it. */
export const saveSharedCollection = (name, items) => {
    storage.set(SHARED_PREFIX + name, JSON.stringify(items));
};

// --- helpers ---------------------------------------------------------------------------------

/** Next free numeric id in a collection of records. */
export const nextId = (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;

/** Drops all ERP-private changes made in this browser (shared data is left to both apps). */
export const resetDemoData = () => {
    storage.removeAllDemoKeys();
    storage.set(VERSION_KEY, String(DATA_VERSION));
    Object.keys(cache).forEach((name) => delete cache[name]);
};
