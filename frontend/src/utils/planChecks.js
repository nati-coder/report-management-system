/**
 * Annual-plan consistency helpers — client side. Mirrors backend/src/utils/planChecks.js:
 *  - HIERARCHY: an item marked "Is sum of sub-items? Yes" equals the sum of its sub-items (same measurement). A percentage is the
 *    AVERAGE of its sub-items instead (SUM / COUNT of the ones that have a value, as in the ranking).
 *  - ZONE TOTALS: woreda targets add up to the zone plan (never above it; exactly, once every woreda is planned).
 * The server enforces both; these helpers show the same checks live while the expert types.
 */
import { summableSubitems, sumSources, chosenSumBlocker, nodesByCode, labelsByCode, isPercent } from './formatTree.js';

export const EPS = 0.005;
export const round = (n) => Math.round(n * 100) / 100;
export const fmt = (n) => (Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(round(n)) : '—');

/**
 * What a parent is worth from its sub-items' numbers (undefined = no value): a count adds them up, a percentage is the average of the
 * ones that have a value (75+75 -> 75, 50+100 -> 75, 50+70 -> 60). Mirrors the server's combine().
 */
export function combine(parent, vals) {
  const present = vals.filter((v) => v !== null && v !== undefined);
  if (!present.length) return undefined;
  const total = present.reduce((s, v) => s + v, 0);
  return round(parent.percent ? total / present.length : total);
}

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
  const byCode = nodesByCode(schema.nodes);
  const labels = labelsByCode(schema.nodes);
  const stack = [...schema.nodes];
  while (stack.length) {
    const n = stack.pop();
    for (const c of n.children || []) stack.push(c);
    if (n.sum_of_subitems === false) continue;
    if (n.sum_of_subitems !== true && isPercent(n.measurement)) continue; // an old format without the flag: a percentage was never a sum
    let found;
    if (n.sum_of_subitems === true && Array.isArray(n.sum_of) && n.sum_of.length) {
      const chosen = sumSources(n, byCode); // the items it lists (e.g. "Total male" = male of each branch)
      found = chosen && !chosenSumBlocker(n, chosen) ? chosen : null;
    } else {
      found = summableSubitems(n);
    }
    if (!found) continue;
    parents.push({ key: n.code, label: labels.get(String(n.code)), percent: isPercent(n.measurement), children: found.map((c) => ({ key: c.code, label: labels.get(String(c.code)) })) });
  }
  return parents;
}

/** Parents in calculation order: each comes after the parents among its own sub-items (same as the server's orderParents). */
export function orderParents(parents) {
  const byKey = new Map(parents.map((p) => [p.key, p]));
  const out = []; const state = new Map();
  for (const root of parents) {
    if (state.has(root.key)) continue;
    const stack = [{ p: root, i: 0 }];
    state.set(root.key, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = top.p.children.map((c) => byKey.get(c.key)).filter(Boolean)[top.i];
      if (next === undefined) { state.set(top.p.key, 2); out.push(top.p); stack.pop(); continue; }
      top.i += 1;
      if (!state.has(next.key)) { state.set(next.key, 1); stack.push({ p: next, i: 0 }); }
    }
  }
  return out;
}

/** { parentKey: message } for every parent that is not the sum of its sub-items (nums = numbers by key). */
export function hierarchyIssues(parents, nums) {
  const issues = {};
  for (const p of parents) {
    const sum = combine(p, p.children.map((c) => nums[c.key]));
    if (sum === undefined) continue;
    const own = nums[p.key];
    const word = p.percent ? 'average' : 'sum';
    if (own === undefined) issues[p.key] = `needs a value — the ${word} of its sub-items is ${fmt(sum)}`;
    else if (Math.abs(own - sum) > EPS) issues[p.key] = `should be ${fmt(sum)} (${word} of sub-items), not ${fmt(own)}`;
  }
  return issues;
}

/** Fill every parent that has sub-item values with their sum (a percentage: their average), deepest first. Returns new string values. */
export function calcParents(parents, values) {
  const out = { ...values };
  const nums = toNumbers(out);
  const ordered = orderParents(parents);
  for (const p of ordered) {
    const sum = combine(p, p.children.map((c) => nums[c.key]));
    if (sum === undefined) continue;
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
