import en from './en';
import ja from './ja';
import vi from './vi';

export type Language = 'en' | 'ja' | 'vi';
export type Translations = typeof en;

export const translations: Record<Language, Translations> = { en, ja, vi };

export const languageLabels: Record<Language, string> = {
  en: 'EN',
  ja: '日本語',
  vi: 'Tiếng Việt',
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  ja: '日本語',
  vi: 'Tiếng Việt',
};

export { en, ja, vi };
