import { formatEcDate } from './ethiopianDate.js';

/** Language is 'en' | 'am'. Amharic dates use the Ethiopic calendar (supported by Intl in modern browsers). */
export const getLang = () => localStorage.getItem('rms_lang') || 'en';
export const setLang = (l) => localStorage.setItem('rms_lang', l);

/** Ethiopian calendar only: "Tikimt 14, 2019 EC" (or Amharic month names when the language is 'am'). */
export function formatDate(value, lang = getLang()) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  if (lang === 'am') return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: 'long', day: 'numeric' }).format(d);
  return formatEcDate(d);
}

export function formatNumber(value, lang = getLang()) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(lang === 'am' ? 'am-ET' : 'en-US', { maximumFractionDigits: 2 }).format(value);
}

export const localName = (row, lang = getLang()) => (lang === 'am' && (row.name_amharic || row.amharic_name)) || row.name;

const T = {
  en: { login: 'Sign in', email: 'Email', password: 'Password', logout: 'Sign out', reports: 'Reports', templates: 'Templates', rankings: 'Rankings', support: 'Support', dashboard: 'Dashboard' },
  am: { login: 'ግባ', email: 'ኢሜይል', password: 'የይለፍ ቃል', logout: 'ውጣ', reports: 'ሪፖርቶች', templates: 'ቅጽ አብነቶች', rankings: 'ደረጃዎች', support: 'ድጋፍ', dashboard: 'ዳሽቦርድ' },
};
export const t = (key, lang = getLang()) => T[lang]?.[key] ?? T.en[key] ?? key;
