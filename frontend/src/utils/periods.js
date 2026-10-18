/** Reporting periods — client side. The plan year runs July → June; month numbers are calendar numbers (July = 7 … June = 6). */
import { MONTH_NAMES, MONTH_NUMBERS } from './planSplit.js';

export const monthName = (n) => MONTH_NAMES[MONTH_NUMBERS.indexOf(Number(n))] ?? String(n);
/** Months in plan-year order, for a select: [{ value: 7, label: 'July' }, …]. */
export const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: MONTH_NUMBERS[i], label }));
/** Quarterly, half-year and annual summaries are built from the monthly reports. */
export const RANGE_OPTIONS = [
  { value: 'q1', label: 'Quarter 1 (July–September)' },
  { value: 'q2', label: 'Quarter 2 (October–December)' },
  { value: 'q3', label: 'Quarter 3 (January–March)' },
  { value: 'q4', label: 'Quarter 4 (April–June)' },
  { value: 'h1', label: 'Half year 1 (July–December)' },
  { value: 'h2', label: 'Half year 2 (January–June)' },
  { value: 'annual', label: 'Annual (July–June)' },
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
