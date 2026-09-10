import i18n from 'i18next';
import detector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import translationENG from './locales/en.json';
import translationCN from './locales/ch.json';

const resources = {
  en: { translation: translationENG },
  cn: { translation: translationCN },
};

// Only 'en' and 'cn' are actually wired up as translation resources (see
// ../common/languages.ts) — map the browser/OS locale onto one of those two
// instead of hard-defaulting to English, so a first-time visitor whose
// system is set to Chinese sees the Chinese UI without having to find and
// use the language dropdown first.
function detectSystemLanguage(): 'en' | 'cn' {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const raw = (nav?.languages && nav.languages[0]) || nav?.language || 'en';
  return /^zh/i.test(raw) ? 'cn' : 'en';
}

const storedLanguage = localStorage.getItem('I18N_LANGUAGE');
const language = storedLanguage || detectSystemLanguage();
if (!storedLanguage) localStorage.setItem('I18N_LANGUAGE', language);

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources,
    lng: language,
    fallbackLng: 'en',

    // IMPORTANT: you are using nested JSON objects like { dashboard: { recentEvents: ... } }
    keySeparator: '.', // must be "."
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
