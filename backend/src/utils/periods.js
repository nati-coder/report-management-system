/**
 * Reporting periods. The plan year runs July → June (month numbers are calendar numbers: July = 7 … June = 6).
 * Quarterly, half-year and annual reports are not filed separately: they are summed up from the monthly ones.
 */
export const PLAN_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
export const MONTH_NAMES = { 7: 'Hamle', 8: 'Nehase', 9: 'Meskerem', 10: 'Tikimt', 11: 'Hidar', 12: 'Tahsas', 1: 'Tir', 2: 'Yekatit', 3: 'Megabit', 4: 'Miazia', 5: 'Genbot', 6: 'Sene' };

export const RANGES = {
  q1: { label: 'Quarter 1 (July–September)', months: [7, 8, 9] },
  q2: { label: 'Quarter 2 (October–December)', months: [10, 11, 12] },
  q3: { label: 'Quarter 3 (January–March)', months: [1, 2, 3] },
  q4: { label: 'Quarter 4 (April–June)', months: [4, 5, 6] },
  h1: { label: 'Half year 1 (July–December)', months: [7, 8, 9, 10, 11, 12] },
  h2: { label: 'Half year 2 (January–June)', months: [1, 2, 3, 4, 5, 6] },
  annual: { label: 'Annual (July–June)', months: PLAN_MONTHS },
};

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

/** "31 Jul 2026, 6:00 pm" in Ethiopian local time, for messages. */
export const when = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Reports are filed month by month for a monthly template, and for an ANNUAL one (the zonal plan expert opens its months). */
export const filedMonthly = (templateType) => templateType === 'monthly' || templateType === 'annual';

/** Ethiopian fiscal year of a date: 2019 = Hamle 2018 → Sene 2019. */
export function currentFiscalYear(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US-u-ca-ethiopic-nu-latn', { year: 'numeric', month: 'numeric', timeZone: 'Africa/Addis_Ababa' }).formatToParts(d);
  const y = Number(p.find((x) => x.type === 'year').value);
  const m = Number(p.find((x) => x.type === 'month').value);
  return m >= 11 ? y + 1 : y; // Hamle (11), Nehase (12), Pagume (13) belong to the next fiscal year
}
