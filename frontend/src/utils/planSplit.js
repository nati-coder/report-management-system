/**
 * Dividing an annual target across the twelve months — client side.
 *  - A count (whole number) is split in whole numbers: 100 over 12 months -> 9,9,9,9,8,8,… (the first months take the extra).
 *  - A decimal is split to 2 places, the remainder spread the same way, so the months always add up exactly.
 *  - A percentage is a rate, not a sum: every month gets the annual rate.
 * Parents are never split on their own — each month's parent is the sum of that month's sub-items.
 */
import { calcParents, toNumbers } from './planChecks.js';

export const MONTHS = 12;
/** The plan year runs Hamle → Sene (Ethiopian fiscal year). The API and database keep the slot number (Hamle = 7 … Sene = 6). */
export const MONTH_NAMES = ['Hamle', 'Nehase', 'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miazia', 'Genbot', 'Sene']; export const MONTH_NUMBERS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const r2 = (n) => Math.round(n * 100) / 100;

/** Twelve strings that add up to `total` exactly (or all equal to it for a percentage). */
export function splitEvenly(total, isPercent = false, parts = MONTHS) {
  if (!Number.isFinite(total)) return Array(parts).fill('');
  if (isPercent) return Array(parts).fill(String(total));
  const unit = Number.isInteger(total) ? 1 : 0.01;
  const units = Math.round(total / unit);
  const base = Math.floor(units / parts);
  const extra = units - base * parts;
  return Array.from({ length: parts }, (_, i) => String(r2((base + (i < extra ? 1 : 0)) * unit)));
}

/** { key: ['…12 strings'] } -> the { key: '…' } map of one month (0-based index). */
export const monthMap = (values, m) => Object.fromEntries(Object.entries(values).map(([k, arr]) => [k, arr?.[m] ?? '']));

/** Apply calcParents to every month: each parent becomes the sum of its sub-items for that month. */
export function calcParentMonths(parents, values) {
  const out = Object.fromEntries(Object.entries(values).map(([k, arr]) => [k, [...arr]]));
  for (let m = 0; m < MONTHS; m += 1) {
    const filled = calcParents(parents, monthMap(out, m));
    for (const p of parents) if (filled[p.key] !== undefined) { out[p.key] = out[p.key] || Array(MONTHS).fill(''); out[p.key][m] = filled[p.key]; }
  }
  return out;
}

/** Which parents are worked out from their sub-items (they have a sub-item in the annual plan). */
export const computedParents = (parents, annual) => new Set(parents.filter((p) => p.children.some((c) => annual[c.key] !== undefined)).map((p) => p.key));

/** Even split of every item in the annual plan; computed parents follow from their sub-items. */
export function autoSplit(items, parents, annual) {
  const computed = computedParents(parents, annual);
  const values = {};
  for (const it of items) {
    if (annual[it.key] === undefined) continue;
    values[it.key] = computed.has(it.key) ? Array(MONTHS).fill('') : splitEvenly(annual[it.key], it.isPercent);
  }
  return calcParentMonths(parents.filter((p) => computed.has(p.key)), values);
}

/** Sum of an item's twelve months (blank = 0). */
export const totalOf = (arr) => r2((arr || []).reduce((s, v) => s + (v === '' || v === undefined ? 0 : Number(v) || 0), 0));

/** { key: [12 strings] } from saved monthly rows ([{ month, data }]). */
export function valuesFromRows(rows, keys) {
  const out = Object.fromEntries(keys.map((k) => [k, Array(MONTHS).fill('')]));
  for (const r of rows || []) {
    const idx = MONTH_NUMBERS.indexOf(r.month);
    if (idx < 0) continue;
    for (const [k, v] of Object.entries(r.data || {})) if (out[k]) out[k][idx] = String(v);
  }
  return out;
}

/** The twelve { month (calendar number), data } objects to send to the API, July first. */
export const monthsPayload = (values) => Array.from({ length: MONTHS }, (_, m) => ({ month: MONTH_NUMBERS[m], data: toNumbers(monthMap(values, m)) }));
