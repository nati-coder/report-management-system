/** Reporting periods — client side. The plan year is the Ethiopian fiscal year, Hamle → Sene; month numbers are slots (Hamle = 7 … Sene = 6). All dates are Ethiopian (EC). */
import { MONTH_NAMES, MONTH_NUMBERS } from './planSplit.js';
import { formatEcDateTime, gregorianWall, fromGregorianWall } from './ethiopianDate.js';

export { currentFiscalYear } from './ethiopianDate.js';

/** Reports are filed month by month for a monthly template and for an annual one (same rule as backend/src/utils/periods.js). */
export const filedMonthly = (templateType) => templateType === 'monthly' || templateType === 'annual';

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

/** "Tikimt 14, 2019 EC, 18:30" — Ethiopian date and Addis Ababa time. */
export const fmtDateTime = (d) => (d ? formatEcDateTime(d) : '—');
const pad = (n) => String(n).padStart(2, '0');
/** Value for the date-time pickers: 'YYYY-MM-DDTHH:mm' on the Addis Ababa wall clock. */
export const toLocalInput = (d) => {
  const g = gregorianWall(d);
  return `${g.year}-${pad(g.month)}-${pad(g.day)}T${pad(g.hour)}:${pad(g.minute)}`;
};
/** ISO string for the API from a picker value (read as Addis Ababa time). */
export const fromLocalInput = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
  return m ? fromGregorianWall(+m[1], +m[2], +m[3], +m[4], +m[5]).toISOString() : undefined;
};

/** "3 days left", "5 hours left", "closed" … for a period with a deadline. */
export function timeLeft(closesAt) {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min left`;
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} left`;
  return `${Math.floor(h / 24)} days left`;
}
