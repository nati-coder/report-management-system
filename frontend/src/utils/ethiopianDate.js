/**
 * Ethiopian calendar (EC) helpers — the system's only calendar.
 *
 * Dates are stored as ordinary instants (UTC timestamps) and are always read and shown as Ethiopian dates in
 * Ethiopian local time (Africa/Addis_Ababa, UTC+3, no daylight saving). The Ethiopian fiscal year (EFY) runs
 * Hamle 1 → Sene 30: EFY 2019 = Hamle 2018 → Sene 2019.
 *
 * This file is identical on the client (frontend/src/utils/ethiopianDate.js) and the server
 * (backend/src/utils/ethiopianDate.js). It only needs Intl, which Node and every modern browser ship with.
 */
const TZ = 'Africa/Addis_Ababa';

/** Ethiopian month names in calendar order (month numbers 1…13). */
export const EC_MONTHS = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miazia', 'Genbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];

const ecFmt = new Intl.DateTimeFormat('en-US-u-ca-ethiopic-nu-latn', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});
const grFmt = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});

const toParts = (fmt, value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const o = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { year: o.year, month: o.month, day: o.day, hour: o.hour % 24, minute: o.minute };
};

/** { year, month (1–13), day, hour, minute } of an instant, as an Ethiopian date in Addis Ababa time. */
export const ecParts = (value) => toParts(ecFmt, value);
/** The same instant as Gregorian wall-clock parts in Addis Ababa time (used only to talk to <input>s and the API). */
export const gregorianWall = (value) => toParts(grFmt, value);
/** Instant from Gregorian wall-clock parts in Addis Ababa time. */
export const fromGregorianWall = (year, month, day, hour = 0, minute = 0) => new Date(Date.UTC(year, month - 1, day, hour - 3, minute));

/** Days in an Ethiopian month: 30 for months 1–12; Pagume has 5, or 6 in a leap year (year % 4 === 3). */
export const ecDaysInMonth = (year, month) => (month <= 12 ? 30 : (year % 4 === 3 ? 6 : 5));

/** Instant for an Ethiopian date and Addis Ababa time of day; null when the date doesn't exist (e.g. Pagume 6 in a normal year). */
export function ecToDate(year, month, day, hour = 0, minute = 0) {
  if (!(month >= 1 && month <= 13) || !(day >= 1 && day <= ecDaysInMonth(year, month))) return null;
  // Meskerem 1 falls on 11 or 12 September of year + 7; search the few days around that estimate.
  const approx = Date.UTC(year + 7, 8, 11) + ((month - 1) * 30 + (day - 1)) * 86400000;
  for (let off = -3; off <= 3; off += 1) {
    const g = new Date(approx + off * 86400000);
    const noon = new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate(), 9, 0)); // 12:00 in Addis
    const p = ecParts(noon);
    if (p.year === year && p.month === month && p.day === day) {
      return fromGregorianWall(g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate(), hour, minute);
    }
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');

/** "Tikimt 14, 2019 EC" */
export function formatEcDate(value) {
  const p = ecParts(value);
  return p ? `${EC_MONTHS[p.month - 1]} ${p.day}, ${p.year} EC` : '—';
}
/** "Tikimt 14, 2019 EC, 18:30" */
export function formatEcDateTime(value) {
  const p = ecParts(value);
  return p ? `${EC_MONTHS[p.month - 1]} ${p.day}, ${p.year} EC, ${pad(p.hour)}:${pad(p.minute)}` : '—';
}

/**
 * Ethiopian fiscal year of a date. Hamle, Nehase and Pagume (months 11–13) belong to the NEXT fiscal year's number:
 * EFY 2019 starts on Hamle 1, 2018.
 */
export function currentFiscalYear(value = new Date()) {
  const p = ecParts(value);
  return p.month >= 11 ? p.year + 1 : p.year;
}
