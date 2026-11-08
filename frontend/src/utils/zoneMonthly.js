/**
 * The zone's monthly plan — client side. A zone has no monthly plan of its own: it is what its woredas' cascaded
 * monthly plans add up to (so it can never disagree with them). A count is the sum of the woredas for that month;
 * a percentage is a rate, so it is the average of the woredas that have one. Drafts are the zonal expert's working
 * copy and are not counted.
 */
import { MONTH_NUMBERS } from './planSplit.js';

export const CASCADED = ['submitted', 'approved'];
const r2 = (n) => Math.round(n * 100) / 100;
const usable = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

/**
 * items = indicatorsOf(format); rows = monthly plan rows [{ woreda_id, month (slot 7…6), status, data }];
 * woredaIds = the zone's woredas. Returns { values: { itemKey: [12 strings, Hamle → Sene] }, woredasCounted }.
 */
export function zoneMonthlyValues(items, rows, woredaIds) {
  const inZone = new Set(woredaIds);
  const counted = (rows || []).filter((r) => inZone.has(r.woreda_id) && CASCADED.includes(r.status));
  const values = {};
  for (const it of items) {
    values[it.key] = MONTH_NUMBERS.map((slot) => {
      const nums = counted.filter((r) => Number(r.month) === slot).map((r) => r.data?.[it.key]).filter(usable).map(Number);
      if (!nums.length) return '';
      const total = nums.reduce((s, v) => s + v, 0);
      return String(r2(it.isPercent ? total / nums.length : total));
    });
  }
  return { values, woredasCounted: new Set(counted.map((r) => r.woreda_id)).size };
}
