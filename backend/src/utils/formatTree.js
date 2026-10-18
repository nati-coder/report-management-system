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
 * `code` is system-assigned from position; plan and report values are keyed by it.
 * A format is locked once approved, so its codes never shift under existing data.
 */
export const MAX_ITEMS = 5000; // sanity cap on total items — depth itself is not limited
const MAX_TITLE = 500;
const MAX_MEASUREMENT = 100;

export const isPercent = (measurement) => /^\s*(%|percent|percentage)\s*$/i.test(measurement || '');

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
    for (let i = 0; i < raw.length; i += 1) {
      const n = raw[i];
      const code = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      if (n === null || typeof n !== 'object' || Array.isArray(n)) return { error: `Item ${code} is not valid` };
      count += 1;
      if (count > MAX_ITEMS) return { error: `A format can have at most ${MAX_ITEMS} items` };

      const title = typeof n.title === 'string' ? n.title.trim() : '';
      if (!title) return { error: `Item ${code}: a title is required` };
      if (title.length > MAX_TITLE) return { error: `Item ${code}: the title is too long (max ${MAX_TITLE} characters)` };

      if (n.measurement != null && typeof n.measurement !== 'string') return { error: `Item ${code}: the measurement must be text` };
      const measurement = (n.measurement ?? '').trim();
      if (measurement.length > MAX_MEASUREMENT) return { error: `Item ${code}: the measurement is too long (max ${MAX_MEASUREMENT} characters)` };

      if (n.children != null && !Array.isArray(n.children)) return { error: `Item ${code}: children must be a list` };

      const node = { code, title, measurement, children: [] };
      out.push(node);
      if (n.children?.length) stack.push({ raw: n.children, out: node.children, prefix: code });
    }
  }
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
    const stack = [...schema.nodes].reverse();
    while (stack.length) {
      const n = stack.pop();
      if (n.measurement) {
        const pct = isPercent(n.measurement);
        out.push({
          key: n.code, title: n.title, label: `${n.code}. ${n.title}`, measurement: n.measurement,
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
      rows.push({ code: n.code, title: n.title, measurement: n.measurement || '', depth });
      for (let i = (n.children || []).length - 1; i >= 0; i -= 1) stack.push({ n: n.children[i], depth: depth + 1 });
    }
    return rows;
  }
  (schema?.sections || []).forEach((s, si) => {
    rows.push({ code: String(si + 1), title: s.title || '', measurement: '', depth: 0 });
    (s.fields || []).filter((f) => ['number', 'percentage', 'currency'].includes(f.type)).forEach((f, fi) => {
      rows.push({
        code: `${si + 1}.${fi + 1}`, title: f.label || '', depth: 1,
        measurement: f.unit || (f.type === 'percentage' ? '%' : f.type === 'currency' ? 'ETB' : 'Number'),
      });
    });
  });
  return rows;
}
