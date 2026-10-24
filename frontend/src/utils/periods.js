/** Reporting periods — client side. The plan year runs July → June; month numbers are calendar numbers (July = 7 … June = 6). */
import { MONTH_NAMES, MONTH_NUMBERS } from './planSplit.js';

export const monthName = (n) => MONTH_NAMES[MONTH_NUMBERS.indexOf(Number(n))] ?? String(n);
/** Months in plan-year order, for a select: [{ value: 7, label: 'July' }, …]. */
export const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: MONTH_NUMBERS[i], label }));
/** Quarterly, half-year and annual summaries are built from the monthly reports. */
export const RANGE_OPTIONS = [
  { value: 'q1', label: 'Quarter 1 (Hamle–Meskerem)' },
  { value: 'q2', label: 'Quarter 2 (Tikimt–Tahsas)' },
  { value: 'q3', label: 'Quarter 3 (Tir–Megabit)' },
  { value: 'q4', label: 'Quarter 4 (Miazia–Sene)' },
  { value: 'h1', label: 'Half year 1 (Hamle–Tahsas)' },
  { value: 'h2', label: 'Half year 2 (Tir–Sene)' },
  { value: 'annual', label: 'Annual (Hamle–Sene)' },
];

export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
/** Value for <input type="datetime-local"> from a date (local time). */
export const toLocalInput = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};
/** ISO string for the API from a datetime-local value. */
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : undefined);

/** "3 days left", "5 hours left", "closed" … for a period with a deadline. */
export function timeLeft(closesAt) {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min left`;
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} left`;
  return `${Math.floor(h / 24)} days left`;
}

/** Ethiopian fiscal year of a date: 2019 = Hamle 2018 → Sene 2019. */
export function currentFiscalYear(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US-u-ca-ethiopic-nu-latn', { year: 'numeric', month: 'numeric', timeZone: 'Africa/Addis_Ababa' }).formatToParts(d);
  const y = Number(p.find((x) => x.type === 'year').value);
  const m = Number(p.find((x) => x.type === 'month').value);
  return m >= 11 ? y + 1 : y; // Hamle (11), Nehase (12), Pagume (13) belong to the next fiscal year
}