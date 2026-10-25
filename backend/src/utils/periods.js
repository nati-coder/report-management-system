import { formatEcDateTime } from './ethiopianDate.js';

export { currentFiscalYear } from './ethiopianDate.js';

/**
 * Reporting periods. The plan year is the Ethiopian fiscal year, Hamle → Sene (month numbers are slots: Hamle = 7 … Sene = 6).
 * Quarterly, half-year and annual reports are not filed separately: they are summed up from the monthly ones.
 */
export const PLAN_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
export const MONTH_NAMES = { 7: 'Hamle', 8: 'Nehase', 9: 'Meskerem', 10: 'Tikimt', 11: 'Hidar', 12: 'Tahsas', 1: 'Tir', 2: 'Yekatit', 3: 'Megabit', 4: 'Miazia', 5: 'Genbot', 6: 'Sene' };

export const RANGES = {
  q1: { label: 'Quarter 1 (Hamle–Meskerem)', months: [7, 8, 9] },
  q2: { label: 'Quarter 2 (Tikimt–Tahsas)', months: [10, 11, 12] },
  q3: { label: 'Quarter 3 (Tir–Megabit)', months: [1, 2, 3] },
  q4: { label: 'Quarter 4 (Miazia–Sene)', months: [4, 5, 6] },
  h1: { label: 'Half year 1 (Hamle–Tahsas)', months: [7, 8, 9, 10, 11, 12] },
  h2: { label: 'Half year 2 (Tir–Sene)', months: [1, 2, 3, 4, 5, 6] },
  annual: { label: 'Annual (Hamle–Sene)', months: PLAN_MONTHS },
};

/**
 * Which months a ranking period covers. Reports are only filed month by month; quarterly and annual figures are
 * built from the months, so a quarterly / annual ranking looks at the monthly reports of those months.
 * `month` / `quarter` left out = the whole fiscal year.
 */
export function monthsOf({ period_type, month, quarter }) {
  if (period_type === 'monthly') return month ? [Number(month)] : PLAN_MONTHS;
  if (period_type === 'quarterly' && quarter) return RANGES[`q${Number(quarter)}`]?.months ?? PLAN_MONTHS;
  return PLAN_MONTHS;
}

/** Report statuses that count (a draft is the woreda's own copy; a rejected report isn't final). */
export const COUNTED = ['submitted', 'reviewing', 'approved'];

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Summarise several months of values: a count is the sum of the months, a percentage is a rate so it is the
 * average of the months that have one. An item no month has a value for is left out.
 *   indicators = [{ key, isPercent }], rows = [{ data }]
 */
export function summarise(indicators, rows) {
  const out = {};
  for (const it of indicators) {
    const vals = rows.map((r) => r.data?.[it.key]).filter((v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
    if (!vals.length) continue;
    const total = vals.reduce((s, v) => s + v, 0);
    out[it.key] = r2(it.isPercent ? total / vals.length : total);
  }
  return out;
}

/** "Tikimt 14, 2019 EC, 18:30" — Ethiopian date and Addis Ababa time, for messages. */
export const when = (d) => formatEcDateTime(d);

/** Reports are filed month by month for a monthly template, and for an ANNUAL one (the zonal plan expert opens its months). */
export const filedMonthly = (templateType) => templateType === 'monthly' || templateType === 'annual';
