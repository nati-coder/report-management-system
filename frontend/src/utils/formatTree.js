/**
 * Report-format hierarchy — client side. A numbered outline (1. / 1.1. / 1.1.1. …) of items
 * that nest without limit, each with only a title and a measurement. Mirrors the server's
 * backend/src/utils/formatTree.js: numbering is by position, and plan / report values are
 * keyed by the item's code. A blank measurement = a heading with no value of its own.
 * `sum_of_subitems` (Yes / No): the item's value is the sum of its sub-items (Yes) or typed by hand (No).
 */
export const MAX_ITEMS = 5000;

/**
 * Split rows (Male / Female …). A row is a leaf with `row: true` that belongs to the item above it. It is not part of the
 * outline numbering: the real sub-items stay 1.1., 1.2. … whatever rows sit beside them, and a row's code is
 * `<parent code>.r1`, `.r2` … Mirrors backend/src/utils/formatTree.js.
 */
export const isRow = (n) => n?.row === true;
/** The codes of one list of siblings: rows are counted apart from the numbered items. */
export function siblingCodes(list, prefix) {
  let item = 0; let row = 0;
  return list.map((n) => (isRow(n) ? (prefix ? `${prefix}.r${++row}` : `r${++row}`) : (prefix ? `${prefix}.${++item}` : String(++item))));
}
/** The code of the item a split row belongs to ("1.r2" -> "1"). */
export const parentCodeOf = (code) => String(code).replace(/(^|\.)r\d+$/, '');
/** What to call an item in a message: "1.1. Head office", or "Male (1. Total employee)" for a split row. */
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
export const isPercent = (m) => /^\s*(%|percent|percentage)\s*$/i.test(m || '');

const uid = () => crypto.randomUUID();
export const newNode = (extra = {}) => ({ _id: uid(), title: '', measurement: '', sum_of_subitems: false, sum_of_ids: [], children: [], row: false, ...extra });

// ---------- sums of sub-items (mirrors backend/src/utils/formatTree.js) ----------
const sameMeasurement = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const measured = (n) => !!(n.measurement || '').trim();

/** The nearest measured items below `node`, looking through headings, in order. */
export function measuredSubitems(node) {
  // an item that has split rows (Male / Female …) is the sum of those rows — adding its sub-items as well would count everyone twice
  const rows = (node.children || []).filter((c) => isRow(c) && measured(c));
  if (rows.length) return rows;
  const found = [];
  const inner = [...(node.children || [])].reverse();
  while (inner.length) {
    const c = inner.pop();
    if (measured(c)) found.push(c);
    else for (let i = (c.children || []).length - 1; i >= 0; i -= 1) inner.push(c.children[i]);
  }
  return found;
}

/** Why `node` cannot be a sum of its sub-items, or null when it can. A percentage can be one: it is then the average of its sub-items. */
export function sumBlocker(node) {
  if (!measured(node)) return 'a heading has no value of its own, so it cannot be a sum';
  const subs = measuredSubitems(node);
  if (!subs.length) return 'it needs at least one sub-item with a measurement to sum';
  if (!subs.every((c) => sameMeasurement(c.measurement, node.measurement))) return `its sub-items must all use the same measurement (${node.measurement.trim()}) to be summed`;
  return null;
}

/** The sub-items the node is the sum of, or null when it is not summable by structure. */
export const summableSubitems = (node) => (sumBlocker(node) ? null : measuredSubitems(node));

/** Why `node` cannot be the sum of the `sources` chosen for it, or null when it can (mirrors the server). */
export function chosenSumBlocker(node, sources) {
  if (!measured(node)) return 'a heading has no value of its own, so it cannot be a sum';
  if (!sources?.length) return 'choose at least one item to sum';
  if (sources.includes(node)) return 'an item cannot be the sum of itself';
  if (!sources.every((c) => measured(c) && sameMeasurement(c.measurement, node.measurement))) return `the items it sums must all use the same measurement (${node.measurement.trim()})`;
  return null;
}

/** The chosen items of an editor node (by their _id) that still exist in the tree. */
export const chosenSources = (node, byId) => (node.sum_of_ids || []).map((id) => byId.get(id)).filter(Boolean);

/** Every item of a saved schema by its code (iterative). */
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

/** Saved item -> the items it is calculated from: the ones it lists in `sum_of`, else its nearest measured sub-items (null if a listed code is missing). Mirrors the server. */
export function sumSources(node, byCode) {
  if (Array.isArray(node.sum_of) && node.sum_of.length) {
    const found = node.sum_of.map((c) => byCode.get(String(c)));
    return found.every(Boolean) ? found : null;
  }
  return measuredSubitems(node);
}

// ---------- reading a tree (iterative: any depth) ----------

/** Depth-first, in order: [{ node, path: [index…], code: '1.1.1', num: '1.1.1.', depth }]. A split row has code '1.r1' and no `num`. */
export function flattenTree(nodes) {
  const rows = [];
  const stack = [];
  const pushList = (list, parentPath, prefix) => {
    const codes = siblingCodes(list, prefix);
    for (let i = list.length - 1; i >= 0; i -= 1) stack.push({ node: list[i], path: [...parentPath, i], code: codes[i] });
  };
  pushList(nodes, [], '');
  while (stack.length) {
    const { node, path, code } = stack.pop();
    rows.push({ node, path, code, num: isRow(node) ? '' : `${code}.`, depth: path.length - 1 });
    pushList(node.children || [], path, code);
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

const siblingsOf = (nodes, path) => (path.length === 1 ? nodes : getNode(nodes, path.slice(0, -1)).children);
/** The nearest sibling in direction `dir` of the same kind (item or row), or -1. Items and rows never swap places. */
const neighbour = (list, idx, dir) => {
  let j = idx + dir;
  while (j >= 0 && j < list.length && isRow(list[j]) !== isRow(list[idx])) j += dir;
  return j >= 0 && j < list.length ? j : -1;
};
export const canMove = (nodes, path, dir) => neighbour(siblingsOf(nodes, path), path[path.length - 1], dir) !== -1;

/** Swap with the previous (-1) or next (+1) sibling of the same kind. */
export function moveNode(nodes, path, dir) {
  const parentPath = path.slice(0, -1); const idx = path[path.length - 1];
  const swap = (arr) => {
    const j = neighbour(arr, idx, dir);
    if (j === -1) return arr;
    const copy = [...arr]; [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  };
  if (!parentPath.length) return swap(nodes);
  return mapAt(nodes, parentPath, (p) => ({ ...p, children: swap(p.children) }));
}

/** The index of the item a node would move under when indented: the nearest numbered item above it (never a row), or -1. */
const indentTarget = (nodes, path) => {
  if (isRow(getNode(nodes, path))) return -1;
  const list = siblingsOf(nodes, path);
  let j = path[path.length - 1] - 1;
  while (j >= 0 && isRow(list[j])) j -= 1;
  return j;
};
export const canIndent = (nodes, path) => indentTarget(nodes, path) !== -1;
export const canOutdent = (nodes, path) => path.length > 1 && !isRow(getNode(nodes, path));

/** Make the item the last child of the numbered item above it (1.2 → 1.1.x). */
export function indentNode(nodes, path) {
  const j = indentTarget(nodes, path);
  if (j === -1) return nodes;
  const node = getNode(nodes, path);
  const prevPath = [...path.slice(0, -1), j];
  const prev = getNode(nodes, prevPath);
  return insertNode(removeNode(nodes, path), prevPath, prev.children.length, node);
}

/** Move the item out of its parent, to sit just after it (1.1.2 → 1.2). */
export function outdentNode(nodes, path) {
  if (!canOutdent(nodes, path)) return nodes;
  const node = getNode(nodes, path);
  const parentPath = path.slice(0, -1);
  return insertNode(removeNode(nodes, path), parentPath.slice(0, -1), parentPath[parentPath.length - 1] + 1, node);
}

/** Where a new item goes when added "below" `path`: right after it, or — for a row — after the last row, so rows stay first. */
export function belowIndex(nodes, path) {
  const list = siblingsOf(nodes, path);
  const idx = path[path.length - 1];
  if (!isRow(list[idx])) return idx + 1;
  let last = idx;
  while (last + 1 < list.length && isRow(list[last + 1])) last += 1;
  return last + 1;
}

/**
 * Split an item into labelled rows — e.g. "Male" and "Female" — placed first among its sub-items. Optionally does the same
 * for each of its direct sub-items (head office, college …) and wires the totals:
 *   the item = the sum of its own rows; each of its rows = the sum of the same row in its sub-items; every sub-item = the sum of its rows.
 * Without `autoSum` only the rows are added and everything stays entered by hand. The wiring is ordinary
 * "sum of sub-items / calculated from" settings, so each one can still be changed afterwards.
 * Returns { nodes } or { error }.
 */
export function splitNode(nodes, path, { labels, measurement = '', includeSubitems = false, autoSum = false }) {
  const names = [];
  for (const l of labels || []) { const t = String(l).trim(); if (t && !names.some((n) => n.toLowerCase() === t.toLowerCase())) names.push(t); }
  if (!names.length) return { error: 'Enter at least one row name, e.g. Male, Female' };

  const target = getNode(nodes, path);
  if (isRow(target)) return { error: 'A row (Male / Female …) cannot be split again' };
  const unit = measurement.trim() || target.measurement?.trim() || '';
  if (!unit) return { error: 'Enter the measurement the rows are reported in, e.g. Persons' };

  const subs = includeSubitems ? target.children.filter((c) => !isRow(c)) : [];
  const clash = (item) => names.find((n) => item.children.some((c) => (c.title || '').trim().toLowerCase() === n.toLowerCase()));
  for (const it of [target, ...subs]) {
    const dup = clash(it);
    if (dup) return { error: `“${it.title || 'This item'}” already has a “${dup}” row` };
  }

  const makeRows = (u) => names.map((title) => newNode({ title, measurement: u, row: true }));
  const targetRows = makeRows(unit);
  const subRows = subs.map((g) => makeRows(g.measurement?.trim() || unit));

  if (autoSum) {
    targetRows.forEach((r, i) => {
      if (!subs.length) return; // nothing to add up: entered by hand
      r.sum_of_subitems = true;
      r.sum_of_ids = subRows.map((rows) => rows[i]._id);
    });
  }
  const newSubs = new Map(subs.map((g, k) => {
    const u = g.measurement?.trim() || unit;
    const base = { ...g, children: [...subRows[k], ...g.children] };
    return [g, autoSum ? { ...base, measurement: u, sum_of_subitems: true, sum_of_ids: subRows[k].map((r) => r._id) } : base];
  }));
  // the new rows come first, then the item's existing children (the sub-items that were split are replaced by their new version)
  const patch = { children: [...targetRows, ...target.children.map((c) => newSubs.get(c) || c)] };
  if (autoSum) Object.assign(patch, { measurement: unit, sum_of_subitems: true, sum_of_ids: targetRows.map((r) => r._id) });
  return { nodes: updateNode(nodes, path, patch) };
}

/**
 * Keeps the split rows of the sub-items in step with their parent. When a row of an item (Male, Female …) is set to
 * "Sum of sub-items? Yes", every sub-item of that item automatically gets a row with the same name and the parent row's
 * measurement, and the parent row becomes the sum of those rows. A sub-item that is only its rows becomes the sum of them.
 * It runs again whenever sub-items are added, moved or removed, so a new sub-item gets its rows by itself. A row whose
 * sum was chosen by hand ("Calculated from") is left alone. Pure: returns a new tree.
 */
export function syncSplits(nodes) {
  const tree = structuredClone(nodes);
  const lower = (t) => String(t || '').trim().toLowerCase();
  const pre = [];
  const stack = [...tree].reverse();
  while (stack.length) { // parents before children, so rows made for a child are seen when the child is handled
    const n = stack.pop();
    pre.push(n);
    for (let i = (n.children || []).length - 1; i >= 0; i -= 1) stack.push(n.children[i]);
  }
  const existing = new Set(pre.map((n) => n._id));
  for (const parent of pre) {
    const kids = (parent.children || []).filter((c) => !isRow(c));
    const sums = (parent.children || []).filter((c) => isRow(c) && c.sum_of_subitems === true && measured(c));
    if (!kids.length || !sums.length) continue;
    const kidRowIds = new Set(kids.flatMap((k) => (k.children || []).filter(isRow).map((r) => r._id)));
    const touched = new Set();
    for (const r of sums) {
      const mine = r.sum_of_ids || [];
      if (mine.length && !mine.every((id) => kidRowIds.has(id) || !existing.has(id))) continue; // chosen by hand (an id whose item was deleted is just stale)
      const ids = [];
      for (const k of kids) {
        k.children = k.children || [];
        let row = k.children.find((c) => isRow(c) && lower(c.title) === lower(r.title));
        if (!row) {
          row = newNode({ title: r.title, measurement: r.measurement, row: true, sum_of_subitems: k.children.some((c) => !isRow(c)) });
          let at = 0; while (at < k.children.length && isRow(k.children[at])) at += 1; // after the rows it already has
          k.children.splice(at, 0, row);
          touched.add(k);
        } else if (mine.includes(row._id)) row.measurement = r.measurement; // follows the parent row
        ids.push(row._id);
      }
      r.sum_of_ids = ids;
    }
    for (const k of touched) {
      if (!measured(k)) k.measurement = sums[0].measurement;
      const own = k.children.filter(isRow).map((c) => c._id);
      const onlyRows = !k.children.some((c) => !isRow(c));
      const ownSum = (k.sum_of_ids || []).length > 0 && k.sum_of_ids.every((id) => own.includes(id));
      if (onlyRows && (!k.sum_of_subitems || ownSum)) Object.assign(k, { sum_of_subitems: true, sum_of_ids: own }); // total = Male + Female
    }
  }
  return tree;
}

/** Edit an item; when it is a parent row that adds up its sub-items' rows, its name / measurement carry over to those rows. */
export function updateRow(nodes, path, patch) {
  const node = getNode(nodes, path);
  let next = updateNode(nodes, path, patch);
  if (!isRow(node) || node.sum_of_subitems !== true || !(node.sum_of_ids || []).length || (patch.title === undefined && patch.measurement === undefined)) return next;
  const parent = getNode(nodes, path.slice(0, -1));
  const linked = new Set((parent?.children || []).filter((c) => !isRow(c)).flatMap((k) => (k.children || []).filter(isRow).map((r) => r._id)));
  const ids = new Set(node.sum_of_ids.filter((id) => linked.has(id)));
  if (!ids.size) return next;
  const carry = {}; if (patch.title !== undefined) carry.title = patch.title; if (patch.measurement !== undefined) carry.measurement = patch.measurement;
  const walk = (list) => list.map((n) => ({ ...(ids.has(n._id) ? { ...n, ...carry } : n), children: walk(n.children || []) }));
  next = walk(next);
  return next;
}

export const countDescendants = (node) => flattenTree([node]).length - 1;

// ---------- to / from the saved schema ----------

/** Editor tree -> API payload (adds codes, drops client-only fields). */
export function treeToSchema(nodes) {
  const codeById = new Map(flattenTree(nodes).map(({ node, code }) => [node._id, code]));
  const walk = (list, prefix) => { const codes = siblingCodes(list, prefix); return list.map((n, i) => {
    const code = codes[i];
    const isSum = measured(n) && n.sum_of_subitems === true; // a heading is never a sum
    const sumOf = isSum ? (n.sum_of_ids || []).map((id) => codeById.get(id)).filter(Boolean) : [];
    return { code, title: n.title, measurement: n.measurement || '', sum_of_subitems: isSum, ...(isRow(n) ? { row: true } : {}), ...(sumOf.length ? { sum_of: sumOf } : {}), children: walk(n.children, code) };
  }); };
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
    const pending = []; // items that sum chosen items: their saved codes become editor ids once every item exists
    const build = (list) => list.map((n) => {
      const node = newNode({
        title: n.title || '', measurement: n.measurement || '', row: n.row === true,
        sum_of_subitems: typeof n.sum_of_subitems === 'boolean' ? n.sum_of_subitems : (summableSubitems(n) !== null && !isPercent(n.measurement)), // a format saved before the flag: a percentage was never a sum
        children: build(n.children || []),
      });
      if (Array.isArray(n.sum_of) && n.sum_of.length) pending.push({ node, codes: n.sum_of });
      return node;
    });
    const tree = build(schema.nodes);
    if (pending.length) {
      const flat = flattenTree(tree); // saved codes are positional, so the k-th saved item is the k-th editor item
      const idByCode = new Map(schemaRows(schema.nodes).map(({ n }, k) => [String(n.code), flat[k].node._id]));
      for (const { node, codes } of pending) node.sum_of_ids = codes.map((c) => idByCode.get(String(c))).filter(Boolean);
    }
    return tree;
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
  const byId = new Map(rows.map(({ node }) => [node._id, node]));
  if (!rows.length) e._tree = 'Add at least one item';
  if (rows.length > MAX_ITEMS) e._tree = `A format can have at most ${MAX_ITEMS} items`;
  for (const { node, code } of rows) {
    if (isRow(node) && !measured(node)) e[code] = 'A row needs a measurement';
    else if (!node.title.trim()) e[code] = 'A title is required';
    else if (node.title.length > 500) e[code] = 'The title is too long (max 500 characters)';
    else if ((node.measurement || '').length > 100) e[code] = 'The measurement is too long (max 100 characters)';
    else if (node.sum_of_subitems && measured(node)) {
      if ((node.sum_of_ids || []).length) {
        const sources = chosenSources(node, byId);
        const why = sources.length < node.sum_of_ids.length ? 'an item it was summing has been removed — choose again' : chosenSumBlocker(node, sources);
        if (why) e[code] = `Cannot be a sum of the items chosen — ${why}`;
      } else {
        const why = sumBlocker(node);
        if (why) e[code] = `Cannot be a sum of its sub-items — ${why}`;
      }
    }
  }
  // Sums must not go in a circle (an item calculated, through other sums, from itself).
  const edges = (n) => (n.sum_of_subitems && measured(n) ? ((n.sum_of_ids || []).length ? chosenSources(n, byId) : measuredSubitems(n)) : []);
  const state = new Map();
  const codeOf = new Map(rows.map(({ node, code }) => [node._id, code]));
  for (const { node: start } of rows) {
    if (state.get(start._id) === 2) continue;
    const stack = [{ n: start, it: edges(start)[Symbol.iterator]() }];
    state.set(start._id, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const nx = top.it.next();
      if (nx.done) { state.set(top.n._id, 2); stack.pop(); continue; }
      const c = nx.value;
      if (state.get(c._id) === 1) { const k = codeOf.get(c._id); if (!e[k]) e[k] = 'The sums go in a circle: this item is calculated from itself'; stack.length = 0; break; }
      if (state.get(c._id) !== 2) { state.set(c._id, 1); stack.push({ n: c, it: edges(c)[Symbol.iterator]() }); }
    }
  }
  return e;
}

/** The values a format asks for (items with a measurement). Understands pre-hierarchy formats too. */
export function indicatorsOf(schema) {
  if (Array.isArray(schema?.nodes)) {
    const labels = labelsByCode(schema.nodes);
    return schemaRows(schema.nodes).filter(({ n }) => n.measurement).map(({ n, d }) => {
      const pct = isPercent(n.measurement);
      return { key: n.code, title: n.title, label: labels.get(String(n.code)), measurement: n.measurement, isPercent: pct, depth: d };
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
    // `num` is what the "No." column shows: a split row (Male / Female) has none and sits, indented, under its item
    return schemaRows(schema.nodes).map(({ n, d }) => ({ code: n.code, num: isRow(n) ? '' : `${n.code}.`, row: isRow(n), title: n.title, measurement: n.measurement || '', depth: d }));
  }
  if (!schema?.sections?.length) return [];
  return flattenTree(schemaToTree(schema)).map(({ node, code, depth }) => ({ code, num: `${code}.`, row: false, title: node.title, measurement: node.measurement || '', depth }));
}
