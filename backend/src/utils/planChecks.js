/**
 * The two consistency rules for annual plans (zone plan and woreda plans alike):
 *
 *  1. HIERARCHY — an item the format marks "Is sum of sub-items? Yes" is calculated as the sum of its
 *     sub-items (applySubitemSums) and must equal it (hierarchyErrors). "Sub-items" are the nearest
 *     measured items below it (headings in between are looked through). An item marked No is entered
 *     by hand and never checked. Formats saved before the flag existed have no value either way: for
 *     those the old rule applies — every measured item whose sub-items share its measurement is a sum
 *     (never for percentages, a rate is not a sum). It applies once at least one sub-item has a value.
 *  2. ZONE TOTALS — for every summable item, the woredas' targets added together must not exceed the
 *     zone plan and, once every woreda of the zone is planned, must equal it.
 *
 * (A frontend copy of the hierarchy helpers lives in frontend/src/utils/planChecks.js — keep them in step.)
 */
import { summableSubitems } from './formatTree.js';

export const EPS = 0.005; // tolerance for decimals typed by hand
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (n) => Math.round(n * 100) / 100;
const fmt = (n) => String(round(n));

/**
 * [{ key, label, measurement, children: [{ key, label }] }] for each item that is a sum of its sub-items (iterative, any depth).
 * An explicit flag wins (true = sum, false = manual); a format saved without the flag falls back to the old structural rule.
 */
export function hierarchyOf(schema) {
  const parents = [];
  if (!Array.isArray(schema?.nodes)) return parents; // older section/KPI formats have no hierarchy
  const stack = [...schema.nodes];
  while (stack.length) {
    const n = stack.pop();
    for (const c of n.children || []) stack.push(c);
    if (n.sum_of_subitems === false) continue;
    const found = summableSubitems(n); // null for headings, percentages, no sub-items or mixed measurements
    if (!found) continue;
    parents.push({
      key: n.code, label: `${n.code}. ${n.title}`, measurement: n.measurement,
      children: found.map((c) => ({ key: c.code, label: `${c.code}. ${c.title}` })),
    });
  }
  return parents;
}

const depthOf = (key) => key.split('.').length;

/**
 * The server's own calculation of the sums: returns a copy of `data` where every sum item that has a value in at least one
 * of its sub-items equals their total — whatever the client sent for it. Deepest items first, so a sum of sums works.
 */
export function applySubitemSums(parents, data) {
  const out = { ...data };
  for (const p of [...parents].sort((a, b) => depthOf(b.key) - depthOf(a.key))) {
    const vals = p.children.map((c) => num(out[c.key]));
    if (vals.every((v) => v === null)) continue;
    out[p.key] = round(vals.reduce((s, v) => s + (v ?? 0), 0));
  }
  return out;
}

/** Messages for every parent whose value is not the sum of its sub-items (empty = consistent). */
export function hierarchyErrors(parents, data) {
  const errors = [];
  for (const p of parents) {
    const vals = p.children.map((c) => num(data[c.key]));
    if (vals.every((v) => v === null)) continue;
    const sum = round(vals.reduce((s, v) => s + (v ?? 0), 0));
    const own = num(data[p.key]);
    if (own === null) errors.push(`${p.label} needs a value — its sub-items add up to ${fmt(sum)}`);
    else if (Math.abs(own - sum) > EPS) errors.push(`${p.label} is ${fmt(own)} but its sub-items add up to ${fmt(sum)}`);
  }
  return errors;
}

/**
 * Woreda targets vs the zone plan. `plans` = [{ data }] of the woredas that count (cascaded, plus the ones being
 * cascaded now). `complete` = every woreda of the zone is planned, so the totals must now match exactly.
 */
export function zoneTotalErrors({ indicators, zoneData, plans, complete }) {
  const errors = [];
  for (const it of indicators) {
    const zone = num(zoneData[it.key]);
    const vals = plans.map((p) => num(p.data[it.key])).filter((v) => v !== null);
    if (zone === null) {
      if (vals.length) errors.push(`${it.label} is not part of the zone plan`);
      continue;
    }
    if (it.isPercent) continue; // rates are not summed
    const total = round(vals.reduce((s, v) => s + v, 0));
    if (total > zone + EPS) {
      errors.push(`${it.label}: the woredas add up to ${fmt(total)}, ${fmt(total - zone)} more than the zone plan (${fmt(zone)})`);
    } else if (complete && Math.abs(total - zone) > EPS) {
      errors.push(`${it.label}: every woreda is planned but they add up to ${fmt(total)}, ${fmt(zone - total)} short of the zone plan (${fmt(zone)})`);
    }
  }
  return errors;
}

/**
 * A woreda's monthly plan vs its annual plan. `months` = [{ month, data }]. For every summable item the twelve
 * months added together must not exceed the annual target and, when `complete` (the plan is being cascaded),
 * must equal it exactly. Percentages are rates, so they are not summed.
 */
export function monthlyTotalErrors({ indicators, annualData, months, complete }) {
  const errors = [];
  for (const it of indicators) {
    const annual = num(annualData[it.key]);
    const vals = months.map((m) => num(m.data[it.key])).filter((v) => v !== null);
    if (annual === null) {
      if (vals.length) errors.push(`${it.label} is not part of the annual plan`);
      continue;
    }
    if (it.isPercent) continue;
    const total = round(vals.reduce((s, v) => s + v, 0));
    if (total > annual + EPS) {
      errors.push(`${it.label}: the months add up to ${fmt(total)}, ${fmt(total - annual)} more than the annual plan (${fmt(annual)})`);
    } else if (complete && Math.abs(total - annual) > EPS) {
      errors.push(`${it.label}: the months add up to ${fmt(total)}, ${fmt(annual - total)} short of the annual plan (${fmt(annual)})`);
    }
  }
  return errors;
}
