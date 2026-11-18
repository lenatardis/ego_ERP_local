import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from './en';

// Demo build (2026-11-18): English version of the ERP (same setup as the CRM's src/i18n/index.js).
// Keys are the original Ukrainian texts: t('Усі замовлення'). Ukrainian needs no dictionary (a missing key is
// shown as is), English is in ./en.js; an English text that's still missing falls back to the Ukrainian one.
// The same works for messages the mock backend sends (`detail`, errors): t(message) translates them.
// The language is shared with the CRM (same origin, same key) and remembered, Ukrainian by default.

export const LANGUAGES = ['uk', 'en'];
export const LANG_STORAGE_KEY = 'ego-demo:lang';
const DEFAULT_LANG = 'uk';

const readStoredLang = () => {
    try {
        const lang = window.localStorage.getItem(LANG_STORAGE_KEY);
        return LANGUAGES.includes(lang) ? lang : DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
};

const applyToDocument = (lang) => {
    document.documentElement.lang = lang;
};

i18n
    .use(initReactI18next)
    .init({
        resources: {en: {translation: en}},
        lng: readStoredLang(),
        fallbackLng: false,
        // Ukrainian sentences contain ':' and '.', so keys are never split into namespaces / nested paths
        keySeparator: false,
        nsSeparator: false,
        returnEmptyString: false,
        interpolation: {escapeValue: false},
        react: {useSuspense: false},
    });

applyToDocument(i18n.language);

export const setLanguage = (lang) => {
    if (!LANGUAGES.includes(lang) || lang === i18n.language) return;
    try {
        window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
        // private window / blocked storage: switch in place (texts in module-level constants stay as they are)
        i18n.changeLanguage(lang);
        return;
    }
    // the ERP's components keep many texts in module-level constants (status maps, filter options, table
    // columns, form schemas), evaluated once on import – so a switch reloads the page instead of re-rendering
    window.__egoLanguageReload = true; // the unsaved-changes guard has already asked (Navigation)
    window.location.reload();
};

i18n.on('languageChanged', applyToDocument);

// the CRM (or another ERP tab) switched the language – reload in it too (see setLanguage)
window.addEventListener('storage', (e) => {
    if (e.key === LANG_STORAGE_KEY && LANGUAGES.includes(e.newValue) && e.newValue !== i18n.language) {
        window.location.reload();
    }
});

// for code outside React components (api modules, helpers)
export const t = (...args) => i18n.t(...args);

export default i18n;
