/** Language is 'en' | 'am'. Amharic dates use the Ethiopic calendar (supported by Intl in modern browsers). */
export const getLang = () => localStorage.getItem('rms_lang') || 'en';
export const setLang = (l) => localStorage.setItem('rms_lang', l);

export function formatDate(value, lang = getLang()) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const locale = lang === 'am' ? 'am-ET-u-ca-ethiopic' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
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
