/**
 * Report-format hierarchy — client side. A numbered outline (1. / 1.1. / 1.1.1. …) of items
 * that nest without limit, each with only a title and a measurement. Mirrors the server's
 * backend/src/utils/formatTree.js: numbering is by position, and plan / report values are
 * keyed by the item's code. A blank measurement = a heading with no value of its own.
 * `sum_of_subitems` (Yes / No): the item's value is the sum of its sub-items (Yes) or typed by hand (No).
 */
export const MAX_ITEMS = 5000;
export const isPercent = (m) => /^\s*(%|percent|percentage)\s*$/i.test(m || '');

const uid = () => crypto.randomUUID();
export const newNode = (extra = {}) => ({ _id: uid(), title: '', measurement: '', sum_of_subitems: false, children: [], ...extra });

// ---------- sums of sub-items (mirrors backend/src/utils/formatTree.js) ----------
const sameMeasurement = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const measured = (n) => !!(n.measurement || '').trim();

/** The nearest measured items below `node`, looking through headings, in order. */
export function measuredSubitems(node) {
  const found = [];
  const inner = [...(node.children || [])].reverse();
  while (inner.length) {
    const c = inner.pop();
    if (measured(c)) found.push(c);
    else for (let i = (c.children || []).length - 1; i >= 0; i -= 1) inner.push(c.children[i]);
  }
  return found;
}

/** Why `node` cannot be a sum of its sub-items, or null when it can. */
export function sumBlocker(node) {
  if (!measured(node)) return 'a heading has no value of its own, so it cannot be a sum';
  if (isPercent(node.measurement)) return 'a percentage is a rate, not a sum';
  const subs = measuredSubitems(node);
  if (!subs.length) return 'it needs at least one sub-item with a measurement to sum';
  if (!subs.every((c) => sameMeasurement(c.measurement, node.measurement))) return `its sub-items must all use the same measurement (${node.measurement.trim()}) to be summed`;
  return null;
}

/** The sub-items the node is the sum of, or null when it is not summable by structure. */
export const summableSubitems = (node) => (sumBlocker(node) ? null : measuredSubitems(node));

// ---------- reading a tree (iterative: any depth) ----------

/** Depth-first, in order: [{ node, path: [index…], code: '1.1.1', depth }]. */
export function flattenTree(nodes) {
  const rows = [];
  const stack = [];
  for (let i = nodes.length - 1; i >= 0; i -= 1) stack.push({ node: nodes[i], path: [i] });
  while (stack.length) {
    const { node, path } = stack.pop();
    rows.push({ node, path, code: path.map((i) => i + 1).join('.'), depth: path.length - 1 });
    for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push({ node: node.children[i], path: [...path, i] });
  }
  return rows;
}

/** Same walk over a *saved* schema (nodes already carry their server-assigned code). */
export function schemaRows(nodes) {
  const rows = [];
  const stack = [...nodes].reverse().map((n) => ({ n, d: 0 }));
  while (stack.length) {
    const { n, d } = stack.pop();
    rows.push({ n, d });
    for (let i = (n.children || []).length - 1; i >= 0; i -= 1) stack.push({ n: n.children[i], d: d + 1 });
  }
  return rows;
}

export function getNode(nodes, path) {
  let list = nodes; let node = null;
  for (const i of path) { node = list[i]; list = node.children; }
  return node;
}

// ---------- editing (immutable, addressed by path) ----------

const mapAt = (nodes, path, fn) => nodes.map((n, i) => {
  if (i !== path[0]) return n;
  return path.length === 1 ? fn(n) : { ...n, children: mapAt(n.children, path.slice(1), fn) };
});
export const updateNode = (nodes, path, patch) => mapAt(nodes, path, (n) => ({ ...n, ...patch }));

export function removeNode(nodes, path) {
  if (path.length === 1) return nodes.filter((_, i) => i !== path[0]);
  return nodes.map((n, i) => (i !== path[0] ? n : { ...n, children: removeNode(n.children, path.slice(1)) }));
}

/** Insert `node` at `index` among the children of `parentPath` ([] = top level). */
export function insertNode(nodes, parentPath, index, node) {
  if (!parentPath.length) return [...nodes.slice(0, index), node, ...nodes.slice(index)];
  return nodes.map((n, i) => (i !== parentPath[0] ? n : { ...n, children: insertNode(n.children, parentPath.slice(1), index, node) }));
}

/** Swap with the previous (-1) or next (+1) sibling. */
export function moveNode(nodes, path, dir) {
  const parentPath = path.slice(0, -1); const idx = path[path.length - 1];
  const swap = (arr) => {
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return arr;
    const copy = [...arr]; [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  };
  if (!parentPath.length) return swap(nodes);
  return mapAt(nodes, parentPath, (p) => ({ ...p, children: swap(p.children) }));
}

/** Make the item the last child of the item above it (1.2 → 1.1.x). */
export function indentNode(nodes, path) {
  const idx = path[path.length - 1];
  if (idx === 0) return nodes;
  const node = getNode(nodes, path);
  const prevPath = [...path.slice(0, -1), idx - 1];
  const prev = getNode(nodes, prevPath);
  return insertNode(removeNode(nodes, path), prevPath, prev.children.length, node);
}

/** Move the item out of its parent, to sit just after it (1.1.2 → 1.2). */
export function outdentNode(nodes, path) {
  if (path.length < 2) return nodes;
  const node = getNode(nodes, path);
  const parentPath = path.slice(0, -1);
  return insertNode(removeNode(nodes, path), parentPath.slice(0, -1), parentPath[parentPath.length - 1] + 1, node);
}

export const countDescendants = (node) => flattenTree([node]).length - 1;

// ---------- to / from the saved schema ----------

/** Editor tree -> API payload (adds codes, drops client-only fields). */
export function treeToSchema(nodes) {
  const walk = (list, prefix) => list.map((n, i) => {
    const code = prefix ? `${prefix}.${i + 1}` : String(i + 1);
    return { code, title: n.title, measurement: n.measurement || '', sum_of_subitems: measured(n) && n.sum_of_subitems === true, children: walk(n.children, code) }; // a heading is never a sum
  });
  return { nodes: walk(nodes, '') };
}

const NUMERIC = ['number', 'percentage', 'currency'];

/**
 * Saved schema (or a template's sections/KPIs, or a format saved before the hierarchy existed)
 * -> editor tree. Sections become top-level items and their numeric KPIs become sub-items;
 * the KPI's unit becomes the measurement.
 */
export function schemaToTree(schema) {
  if (Array.isArray(schema?.nodes) && schema.nodes.length) {
    // A format saved before the Yes / No existed has no value: it behaved as "Yes" wherever the old rule applied,
    // so the editor shows that, and saving does not silently change how its plans add up.
    const build = (list) => list.map((n) => newNode({
      title: n.title || '', measurement: n.measurement || '',
      sum_of_subitems: typeof n.sum_of_subitems === 'boolean' ? n.sum_of_subitems : summableSubitems(n) !== null,
      children: build(n.children || []),
    }));
    return build(schema.nodes);
  }
  const converted = (schema?.sections || []).map((s) => newNode({
    title: s.title || '',
    children: (s.fields || []).filter((f) => NUMERIC.includes(f.type)).map((f) => newNode({
      title: f.label || '',
      measurement: f.unit || (f.type === 'percentage' ? '%' : f.type === 'currency' ? 'ETB' : 'Number'),
    })),
  }));
  return converted.length ? converted : [newNode()];
}

/** Errors keyed by item code (plus `_tree` for whole-tree problems). Empty object = valid. */
export function validateTree(nodes) {
  const e = {};
  const rows = flattenTree(nodes);
  if (!rows.length) e._tree = 'Add at least one item';
  if (rows.length > MAX_ITEMS) e._tree = `A format can have at most ${MAX_ITEMS} items`;
  for (const { node, code } of rows) {
    if (!node.title.trim()) e[code] = 'A title is required';
    else if (node.title.length > 500) e[code] = 'The title is too long (max 500 characters)';
    else if ((node.measurement || '').length > 100) e[code] = 'The measurement is too long (max 100 characters)';
    else if (node.sum_of_subitems && measured(node)) {
      const why = sumBlocker(node);
      if (why) e[code] = `Cannot be a sum of its sub-items — ${why}`;
    }
  }
  return e;
}

/** The values a format asks for (items with a measurement). Understands pre-hierarchy formats too. */
export function indicatorsOf(schema) {
  if (Array.isArray(schema?.nodes)) {
    return schemaRows(schema.nodes).filter(({ n }) => n.measurement).map(({ n, d }) => {
      const pct = isPercent(n.measurement);
      return { key: n.code, title: n.title, label: `${n.code}. ${n.title}`, measurement: n.measurement, isPercent: pct, depth: d };
    });
  }
  return (schema?.sections || []).flatMap((s) => (s.fields || []).filter((f) => NUMERIC.includes(f.type)).map((f) => ({
    key: f.key, title: f.label, label: f.label, measurement: f.unit || (f.type === 'percentage' ? '%' : f.type === 'currency' ? 'ETB' : 'Number'),
    isPercent: f.type === 'percentage', depth: 0,
  })));
}

/**
 * A saved format as table rows, in order: [{ code, title, measurement, depth }]. Formats saved in the
 * earlier section/KPI layout are shown the way the editor shows them (sections as headings, numeric KPIs under them).
 */
export function formatRows(schema) {
  if (Array.isArray(schema?.nodes)) {
    return schemaRows(schema.nodes).map(({ n, d }) => ({ code: n.code, title: n.title, measurement: n.measurement || '', depth: d }));
  }
  if (!schema?.sections?.length) return [];
  return flattenTree(schemaToTree(schema)).map(({ node, code, depth }) => ({ code, title: node.title, measurement: node.measurement || '', depth }));
}
