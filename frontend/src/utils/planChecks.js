/**
 * Annual-plan consistency helpers — client side. Mirrors backend/src/utils/planChecks.js:
 *  - HIERARCHY: an item marked "Is sum of sub-items? Yes" equals the sum of its sub-items (same measurement, never for %).
 *  - ZONE TOTALS: woreda targets add up to the zone plan (never above it; exactly, once every woreda is planned).
 * The server enforces both; these helpers show the same checks live while the expert types.
 */
import { summableSubitems } from './formatTree.js';

export const EPS = 0.005;
export const round = (n) => Math.round(n * 100) / 100;
export const fmt = (n) => (Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(round(n)) : '—');
const depthOf = (key) => key.split('.').length;

/** { key: '12' } typed strings -> { key: 12 } numbers (blank / non-numeric values dropped). */
export function toNumbers(values) {
  const out = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (v === '' || v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/**
 * Items that are a sum of their sub-items: [{ key, label, children: [{ key, label }] }] — nearest measured sub-items, looking
 * through headings. The format's "Is sum of sub-items?" decides (Yes = sum, No = typed by hand); a format saved before
 * it existed has no value and keeps the old rule. Same result as the server's hierarchyOf (a test keeps them in step).
 */
export function hierarchyOf(schema) {
  const parents = [];
  if (!Array.isArray(schema?.nodes)) return parents;
  const stack = [...schema.nodes];
  while (stack.length) {
    const n = stack.pop();
    for (const c of n.children || []) stack.push(c);
    if (n.sum_of_subitems === false) continue;
    const found = summableSubitems(n);
    if (!found) continue;
    parents.push({ key: n.code, label: `${n.code}. ${n.title}`, children: found.map((c) => ({ key: c.code, label: `${c.code}. ${c.title}` })) });
  }
  return parents;
}

/** { parentKey: message } for every parent that is not the sum of its sub-items (nums = numbers by key). */
export function hierarchyIssues(parents, nums) {
  const issues = {};
  for (const p of parents) {
    const vals = p.children.map((c) => nums[c.key]);
    if (vals.every((v) => v === undefined)) continue;
    const sum = round(vals.reduce((s, v) => s + (v ?? 0), 0));
    const own = nums[p.key];
    if (own === undefined) issues[p.key] = `needs a value — sub-items add up to ${fmt(sum)}`;
    else if (Math.abs(own - sum) > EPS) issues[p.key] = `should be ${fmt(sum)} (sum of sub-items), not ${fmt(own)}`;
  }
  return issues;
}

/** Fill every parent that has sub-item values with their sum, deepest first. Returns new string values. */
export function calcParents(parents, values) {
  const out = { ...values };
  const nums = toNumbers(out);
  const ordered = [...parents].sort((a, b) => depthOf(b.key) - depthOf(a.key));
  for (const p of ordered) {
    if (p.children.every((c) => nums[c.key] === undefined)) continue;
    const sum = round(p.children.reduce((s, c) => s + (nums[c.key] ?? 0), 0));
    nums[p.key] = sum;
    out[p.key] = String(sum);
  }
  return out;
}

/** Spread nothing — status of one summable item: remaining = zone − (others + this). */
export function totalState(zone, others, own) {
  const remaining = round(zone - (others + own));
  if (Math.abs(remaining) <= EPS) return { remaining: 0, state: 'ok' };
  return remaining > 0 ? { remaining, state: 'short' } : { remaining, state: 'over' };
}
