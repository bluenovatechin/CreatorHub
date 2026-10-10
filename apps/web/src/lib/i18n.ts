/**
 * TRANSLATIONS (English + Gujarati) using i18next. Texts live in src/i18n/en.json and gu.json
 * (both files must have the same keys). Also translates form validation messages.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import en from '../i18n/en.json';
import gu from '../i18n/gu.json';

export type Lang = 'gu' | 'en';
const STORAGE_KEY = 'bn_lang';

/** Per-browser language preference (a convenience only; the account preference is saved on the server). */
function storedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'en' || v === 'gu' ? v : 'gu';
  } catch {
    return 'gu';
  }
}

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable: language still changes for this session */
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, gu: { translation: gu } },
  lng: storedLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes output
  returnObjects: true,
});
document.documentElement.lang = i18n.language;

/** zod's built-in messages become i18n keys; schema-specific messages (errors.*) are kept. */
z.setErrorMap((issue) => {
  if (issue.code === 'invalid_type' && issue.received === 'undefined') return { message: 'errors.zod.invalid_type' };
  if (issue.code === 'invalid_type' && issue.received === 'nan') return { message: 'errors.zod.invalid_type' };
  return { message: `errors.zod.${issue.code}` };
});

export default i18n;
