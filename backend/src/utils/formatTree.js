/**
 * Report-format hierarchy: a numbered outline of items that nest without limit.
 *
 *   1.            { code: '1',     title, measurement, children: [...] }
 *     1.1.        { code: '1.1',   ... }
 *       1.1.1.    { code: '1.1.1', ... }
 *   2.
 *
 * Each item has only a title and a measurement (the unit its value is reported in).
 * A blank measurement means the item is a heading with no value of its own.
 * `sum_of_subitems` (true / false) says whether the item's value is calculated as the sum of its
 * sub-items (true) or entered by hand (false). Formats saved before the flag existed have no such key:
 * for those the old rule still applies (see summableSubitems and planChecks.hierarchyOf).
 * `code` is system-assigned from position; plan and report values are keyed by it.
 * A format is locked once approved, so its codes never shift under existing data.
 */
export const MAX_ITEMS = 5000; // sanity cap on total items — depth itself is not limited
const MAX_TITLE = 500;
const MAX_MEASUREMENT = 100;

/**
 * Split rows (Male / Female …). A row is a leaf with `row: true` that belongs to the item above it. It is not part of the
 * outline numbering: the real sub-items stay 1.1., 1.2. … whatever rows sit beside them, and a row's code is
 * `<parent code>.r1`, `.r2` … (so a code is still unique and still starts with its parent's code + '.').
 */
export const isRow = (n) => n?.row === true;

/** The codes of the items of one list of siblings: rows are counted apart from the numbered items. */
export function siblingCodes(list, prefix) {
  let item = 0; let row = 0;
  return list.map((n) => (isRow(n) ? (prefix ? `${prefix}.r${++row}` : `r${++row}`) : (prefix ? `${prefix}.${++item}` : String(++item))));
}

/** What to call an item in a message: "1.1. Head office", or "Male (1.1. Head office)" for a split row. */
export function labelsByCode(nodes) {
  const out = new Map();
  const stack = [...(nodes || [])].reverse().map((n) => ({ n, parent: null }));
  while (stack.length) {
    const { n, parent } = stack.pop();
    const own = `${n.code}. ${n.title}`;
    out.set(String(n.code), isRow(n) && parent ? `${n.title} (${parent})` : own);
    for (let i = (n.children || []).length - 1; i >= 0; i -= 1) stack.push({ n: n.children[i], parent: own });
  }
  return out;
}

export const isPercent = (measurement) => /^\s*(%|percent|percentage)\s*$/i.test(measurement || '');
const sameMeasurement = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/** The nearest measured items below `node`, looking through headings (iterative, any depth), in document order. */
export function measuredSubitems(node) {
  // an item that has split rows (Male / Female …) is the sum of those rows — adding its sub-items as well would count everyone twice
  const rows = (node.children || []).filter((c) => isRow(c) && c.measurement);
  if (rows.length) return rows;
  const found = [];
  const inner = [...(node.children || [])].reverse();
  while (inner.length) {
    const c = inner.pop();
    if (c.measurement) found.push(c);
    else for (let i = (c.children || []).length - 1; i >= 0; i -= 1) inner.push(c.children[i]);
  }
  return found;
}

/**
 * Why `node` cannot be a sum of its sub-items, or null when it can. A sum needs a value of its own (a measurement),
 * is never a percentage (a rate is not a sum), and needs at least one measured sub-item, all in the same measurement.
 */
export function sumBlocker(node) {
  if (!node.measurement) return 'a heading has no value of its own, so it cannot be a sum';
  if (isPercent(node.measurement)) return 'a percentage is a rate, not a sum';
  const subs = measuredSubitems(node);
  if (!subs.length) return 'it needs at least one sub-item with a measurement to sum';
  if (!subs.every((c) => sameMeasurement(c.measurement, node.measurement))) return `its sub-items must all use the same measurement (${node.measurement}) to be summed`;
  return null;
}

/** The sub-items the node is the sum of, or null when it is not summable by structure. */
export const summableSubitems = (node) => (sumBlocker(node) ? null : measuredSubitems(node));

/** Every item of a tree by its code (iterative, any depth). */
export function nodesByCode(nodes) {
  const map = new Map();
  const stack = [...(nodes || [])];
  while (stack.length) {
    const n = stack.pop();
    if (n.code != null) map.set(String(n.code), n);
    for (const c of n.children || []) stack.push(c);
  }
  return map;
}

/**
 * The items a "sum" item is calculated from. Normally its nearest measured sub-items; when the item lists `sum_of`
 * (codes of other items, anywhere in the format) it is the sum of exactly those — e.g. "Total male" = the male item
 * of each branch. Returns null when a listed code does not exist.
 */
export function sumSources(node, byCode) {
  if (Array.isArray(node.sum_of) && node.sum_of.length) {
    const found = node.sum_of.map((c) => byCode.get(String(c)));
    return found.every(Boolean) ? found : null;
  }
  return measuredSubitems(node);
}

/** Why `node` cannot be the sum of the items it lists in `sum_of`, or null when it can. */
export function chosenSumBlocker(node, sources) {
  if (!node.measurement) return 'a heading has no value of its own, so it cannot be a sum';
  if (isPercent(node.measurement)) return 'a percentage is a rate, not a sum';
  if (!sources?.length) return 'choose at least one item to sum';
  if (sources.includes(node)) return 'an item cannot be the sum of itself';
  if (!sources.every((c) => c.measurement && sameMeasurement(c.measurement, node.measurement))) return `the items it sums must all use the same measurement (${node.measurement})`;
  return null;
}

/** The code of an item that (through its sums) depends on itself, or null. Iterative, so depth never overflows the stack. */
export function sumCycle(nodes) {
  const byCode = nodesByCode(nodes);
  const edges = (n) => (n.sum_of_subitems === true ? (sumSources(n, byCode) || []) : []);
  const state = new Map(); // code -> 1 visiting, 2 done
  for (const start of byCode.values()) {
    if (state.get(start.code) === 2) continue;
    const stack = [{ n: start, it: edges(start)[Symbol.iterator]() }];
    state.set(start.code, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const nx = top.it.next();
      if (nx.done) { state.set(top.n.code, 2); stack.pop(); continue; }
      const c = nx.value;
      if (state.get(c.code) === 1) return c.code;
      if (state.get(c.code) !== 2) { state.set(c.code, 1); stack.push({ n: c, it: edges(c)[Symbol.iterator]() }); }
    }
  }
  return null;
}

/**
 * Validate + number a tree. Iterative (explicit stack), so depth never overflows the call stack.
 * Returns { nodes } with codes and only title / measurement / children kept, or { error }.
 */
export function normalizeNodes(rawNodes) {
  if (!Array.isArray(rawNodes) || !rawNodes.length) return { error: 'Add at least one item' };

  let count = 0;
  const root = [];
  const stack = [{ raw: rawNodes, out: root, prefix: '' }];
  while (stack.length) {
    const { raw, out, prefix } = stack.pop();
    // rows (Male / Female …) are numbered apart from the items, so 1.1. is the first real sub-item
    const isObj = (n) => n !== null && typeof n === 'object' && !Array.isArray(n);
    const codes = siblingCodes(raw.map((n) => (isObj(n) ? n : {})), prefix);
    for (let i = 0; i < raw.length; i += 1) {
      const n = raw[i];
      const code = codes[i];
      if (!isObj(n)) return { error: `Item ${code} is not valid` };
      if (n.row != null && typeof n.row !== 'boolean') return { error: `Item ${code}: row must be true or false` };
      if (n.row === true && !prefix) return { error: `Item ${code}: a row (Male / Female …) must sit under an item` };
      if (n.row === true && n.children?.length) return { error: `Item ${code}: a row cannot have sub-items` };
      count += 1;
      if (count > MAX_ITEMS) return { error: `A format can have at most ${MAX_ITEMS} items` };

      const title = typeof n.title === 'string' ? n.title.trim() : '';
      if (!title) return { error: `Item ${code}: a title is required` };
      if (title.length > MAX_TITLE) return { error: `Item ${code}: the title is too long (max ${MAX_TITLE} characters)` };

      if (n.measurement != null && typeof n.measurement !== 'string') return { error: `Item ${code}: the measurement must be text` };
      const measurement = (n.measurement ?? '').trim();
      if (measurement.length > MAX_MEASUREMENT) return { error: `Item ${code}: the measurement is too long (max ${MAX_MEASUREMENT} characters)` };

      if (n.children != null && !Array.isArray(n.children)) return { error: `Item ${code}: children must be a list` };

      if (n.sum_of_subitems != null && typeof n.sum_of_subitems !== 'boolean') return { error: `Item ${code}: "Is sum of sub-items?" must be Yes or No` };

      if (n.sum_of != null && (!Array.isArray(n.sum_of) || n.sum_of.length > 200 || n.sum_of.some((c) => typeof c !== 'string'))) return { error: `Item ${code}: the items to sum must be a list of item numbers` };

      // Always written out, so a saved format never depends on the old inferred rule.
      if (n.row === true && !measurement) return { error: `Item ${code}: a row needs a measurement` };
      const node = { code, title, measurement, sum_of_subitems: n.sum_of_subitems === true, ...(n.row === true ? { row: true } : {}), children: [] };
      // Optional: sum these items instead of the sub-items. Only meaningful for a sum item; checked once the whole tree is numbered.
      if (node.sum_of_subitems && n.sum_of?.length) node.sum_of = [...new Set(n.sum_of.map((c) => c.trim()))];
      out.push(node);
      if (n.children?.length) stack.push({ raw: n.children, out: node.children, prefix: code });
    }
  }

  // A "sum" item must really have something to sum (checked on the cleaned-up tree): its sub-items, or the items it lists.
  const byCode = nodesByCode(root);
  const check = [...root];
  while (check.length) {
    const node = check.pop();
    if (node.sum_of_subitems) {
      if (node.sum_of) {
        const missing = node.sum_of.find((c) => !byCode.has(c));
        if (missing) return { error: `Item ${node.code}: it sums item ${missing}, which does not exist` };
        const why = chosenSumBlocker(node, node.sum_of.map((c) => byCode.get(c)));
        if (why) return { error: `Item ${node.code}: it cannot be a sum of the items chosen — ${why}` };
      } else {
        const why = sumBlocker(node);
        if (why) return { error: `Item ${node.code}: it cannot be a sum of its sub-items — ${why}` };
      }
    }
    for (const c of node.children) check.push(c);
  }
  const loop = sumCycle(root);
  if (loop) return { error: `Item ${loop}: the sums go in a circle (an item is calculated from itself)` };
  return { nodes: root, count };
}

/**
 * The values a format asks for, in document order: [{ key, label, title, measurement, isPercent, min, max }].
 * Understands the hierarchy (items that have a measurement) and formats saved before it existed
 * (numeric KPIs in sections), so those keep working.
 */
export function indicatorsOf(schema) {
  const out = [];
  if (Array.isArray(schema?.nodes)) {
    const labels = labelsByCode(schema.nodes);
    const stack = [...schema.nodes].reverse();
    while (stack.length) {
      const n = stack.pop();
      if (n.measurement) {
        const pct = isPercent(n.measurement);
        out.push({
          key: n.code, title: n.title, label: labels.get(String(n.code)), measurement: n.measurement,
          isPercent: pct, min: pct ? 0 : null, max: pct ? 100 : null,
        });
      }
      for (let i = (n.children || []).length - 1; i >= 0; i -= 1) stack.push(n.children[i]);
    }
    return out;
  }
  for (const s of schema?.sections || []) {
    for (const f of s.fields || []) {
      if (!['number', 'percentage', 'currency'].includes(f.type)) continue;
      const pct = f.type === 'percentage';
      out.push({
        key: f.key, title: f.label, label: f.label, measurement: f.unit || (pct ? '%' : f.type === 'currency' ? 'ETB' : 'Number'),
        isPercent: pct, min: pct ? Math.max(0, f.min ?? 0) : (f.min ?? null), max: pct ? Math.min(100, f.max ?? 100) : (f.max ?? null),
      });
    }
  }
  return out;
}

/**
 * A format as flat table rows, in document order: [{ code, title, measurement, depth }].
 * Used by the CSV / Excel export. Formats saved in the earlier section/KPI layout are shown the way the
 * editor shows them: each section a heading, each numeric KPI an item under it.
 */
export function rowsOf(schema) {
  const rows = [];
  if (Array.isArray(schema?.nodes)) {
    const stack = [...schema.nodes].reverse().map((n) => ({ n, depth: 0 }));
    while (stack.length) {
      const { n, depth } = stack.pop();
      // `num` is the number shown in the "No." column: a split row (Male / Female) has none
      rows.push({ code: n.code, num: isRow(n) ? '' : `${n.code}.`, title: n.title, measurement: n.measurement || '', depth, row: isRow(n), sum: n.sum_of_subitems === true });
      for (let i = (n.children || []).length - 1; i >= 0; i -= 1) stack.push({ n: n.children[i], depth: depth + 1 });
    }
    return rows;
  }
  (schema?.sections || []).forEach((s, si) => {
    rows.push({ code: String(si + 1), num: `${si + 1}.`, title: s.title || '', measurement: '', depth: 0, row: false });
    (s.fields || []).filter((f) => ['number', 'percentage', 'currency'].includes(f.type)).forEach((f, fi) => {
      rows.push({
        code: `${si + 1}.${fi + 1}`, num: `${si + 1}.${fi + 1}.`, title: f.label || '', depth: 1, row: false,
        measurement: f.unit || (f.type === 'percentage' ? '%' : f.type === 'currency' ? 'ETB' : 'Number'),
      });
    });
  });
  return rows;
}
