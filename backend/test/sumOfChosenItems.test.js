// An item can add up items chosen from anywhere in the format, not only its own sub-items:
//   Total employee   = Male + Female
//   Male             = Head office male + College male        (and the same for Female)
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNodes } from '../src/utils/formatTree.js';
import { hierarchyOf, applySubitemSums, hierarchyErrors, orderParents } from '../src/utils/planChecks.js';
import * as client from '../../frontend/src/utils/formatTree.js';
import * as clientChecks from '../../frontend/src/utils/planChecks.js';

const u = 'Persons';
const item = (title, extra = {}, children = []) => ({ title, measurement: u, children, ...extra });

// 1 Total employee; 1.1 Male; 1.2 Female; 1.3 Head office (1.3.1 Male, 1.3.2 Female); 1.4 College (1.4.1 Male, 1.4.2 Female)
const raw = () => [
  item('Total employee', { sum_of_subitems: true, sum_of: ['1.1', '1.2'] }, [
    item('Male', { sum_of_subitems: true, sum_of: ['1.3.1', '1.4.1'] }),
    item('Female', { sum_of_subitems: true, sum_of: ['1.3.2', '1.4.2'] }),
    item('Head office employee', { sum_of_subitems: true }, [item('Male'), item('Female')]),
    item('College employee', { sum_of_subitems: true }, [item('Male'), item('Female')]),
  ]),
];

test('the format saves, keeping which items each sum adds up', () => {
  const { nodes, error } = normalizeNodes(raw());
  assert.equal(error, undefined);
  assert.deepEqual(nodes[0].sum_of, ['1.1', '1.2']);
  assert.deepEqual(nodes[0].children[0].sum_of, ['1.3.1', '1.4.1']);
  assert.equal(nodes[0].children[2].sum_of, undefined); // head office adds up its own sub-items
});

test('Total = Male + Female and Male = head office male + college male, with no double counting', () => {
  const { nodes } = normalizeNodes(raw());
  const parents = hierarchyOf({ nodes });
  const keysOf = (k) => parents.find((p) => p.key === k).children.map((c) => c.key);
  assert.deepEqual(keysOf('1'), ['1.1', '1.2']);
  assert.deepEqual(keysOf('1.1'), ['1.3.1', '1.4.1']);
  assert.deepEqual(keysOf('1.2'), ['1.3.2', '1.4.2']);
  assert.deepEqual(keysOf('1.3'), ['1.3.1', '1.3.2']);

  const out = applySubitemSums(parents, { '1.3.1': 10, '1.3.2': 7, '1.4.1': 5, '1.4.2': 8, 1: 999, '1.1': 999 });
  assert.equal(out['1.1'], 15);   // male  = 10 + 5
  assert.equal(out['1.2'], 15);   // female = 7 + 8
  assert.equal(out['1'], 30);     // total = male + female (not also head office + college)
  assert.equal(out['1.3'], 17);
  assert.equal(out['1.4'], 13);
  assert.deepEqual(hierarchyErrors(parents, out), []);
  assert.equal(hierarchyErrors(parents, { ...out, 1: 31 }).length, 1);
});

test('a sum of chosen items is calculated after the sums it depends on, whatever the numbering', () => {
  const { nodes } = normalizeNodes(raw());
  const order = orderParents(hierarchyOf({ nodes })).map((p) => p.key);
  assert.ok(order.indexOf('1.1') < order.indexOf('1'));
  assert.ok(order.indexOf('1.2') < order.indexOf('1'));
});

test('bad choices are refused', () => {
  const bad = (sum_of, extra = {}) => normalizeNodes([item('Total', { sum_of_subitems: true, sum_of, ...extra }, [item('A'), item('B', { measurement: 'ETB' })])]).error;
  assert.match(bad(['1.9']), /does not exist/);
  assert.match(bad(['1']), /itself/);
  assert.match(bad(['1.1', '1.2']), /same measurement/);
  assert.match(normalizeNodes([item('T', { sum_of_subitems: true, sum_of: 'x' })]).error, /list of item numbers/);
});

test('sums that go in a circle are refused', () => {
  const circle = normalizeNodes([
    item('A', { sum_of_subitems: true, sum_of: ['2'] }),
    item('B', { sum_of_subitems: true, sum_of: ['1'] }),
  ]);
  assert.match(circle.error, /circle/);
  // an item cannot sum its own parent when the parent sums its sub-items
  const viaParent = normalizeNodes([item('P', { sum_of_subitems: true }, [item('C', { sum_of_subitems: true, sum_of: ['1'] })])]);
  assert.match(viaParent.error, /circle/);
});

test('"sum of sub-items" without a choice behaves exactly as before', () => {
  const { nodes } = normalizeNodes([item('T', { sum_of_subitems: true }, [item('A'), item('B')])]);
  assert.equal(nodes[0].sum_of, undefined);
  assert.deepEqual(hierarchyOf({ nodes }).map((p) => `${p.key}:${p.children.map((c) => c.key)}`), ['1:1.1,1.2']);
});

test('the client calculates the same sums as the server', () => {
  const { nodes } = normalizeNodes(raw());
  const keys = (ps) => ps.map((p) => `${p.key}:${p.children.map((c) => c.key).join(',')}`).sort();
  assert.deepEqual(keys(clientChecks.hierarchyOf({ nodes })), keys(hierarchyOf({ nodes })));
  const calc = clientChecks.calcParents(clientChecks.hierarchyOf({ nodes }), { '1.3.1': '10', '1.3.2': '7', '1.4.1': '5', '1.4.2': '8' });
  assert.deepEqual([calc['1'], calc['1.1'], calc['1.2']], ['30', '15', '15']);
});

test('the editor keeps the chosen items through save and load, even when items are moved', () => {
  const tree = client.schemaToTree(normalizeNodes(raw()).nodes && { nodes: normalizeNodes(raw()).nodes });
  const total = tree[0];
  assert.equal(total.sum_of_ids.length, 2);
  assert.deepEqual(client.validateTree(tree), {});
  // move "Female" above "Male": the codes change, the sums must follow the items, not the numbers
  const moved = client.moveNode(tree, [0, 1], -1);
  const saved = client.treeToSchema(moved).nodes[0];
  assert.deepEqual(saved.sum_of, ['1.2', '1.1']);                         // total adds up Male (now 1.2) and Female (now 1.1)
  assert.deepEqual(saved.children[0].sum_of, ['1.3.2', '1.4.2']);         // Female, now first
  assert.equal(normalizeNodes(saved ? client.treeToSchema(moved).nodes : []).error, undefined);
});

test('the editor flags a sum whose chosen item was removed, and circles', () => {
  const tree = client.schemaToTree({ nodes: normalizeNodes(raw()).nodes });
  const maleId = tree[0].children[0]._id;
  const without = client.removeNode(tree, [0, 2]); // remove head office: Male's chosen "1.3.1" disappears
  assert.match(client.validateTree(without)['1.1'], /removed/);
  assert.equal(maleId, tree[0].children[0]._id);
  const circular = client.updateNode(tree, [0, 0], { sum_of_ids: [tree[0]._id] }); // male = total, total = male
  assert.match(Object.values(client.validateTree(circular)).join(' '), /circle/);
});

// ---- "Split…" in the builder: rows such as Male / Female added and wired in one step ----
test('Split adds Male/Female to an item and its sub-items and wires the totals', () => {
  const start = [client.newNode({ title: 'Total employee', measurement: u, children: [
    client.newNode({ title: 'Head office', measurement: u }), client.newNode({ title: 'College', measurement: u })] })];
  const r = client.splitNode(start, [0], { labels: ['Male', 'Female'], includeSubitems: true, autoSum: true });
  assert.equal(r.error, undefined);
  assert.deepEqual(client.validateTree(r.nodes), {});
  const schema = client.treeToSchema(r.nodes);
  assert.deepEqual(client.flattenTree(r.nodes).map((x) => `${x.code} ${x.node.title}`), [
    '1 Total employee', '1.r1 Male', '1.r2 Female', '1.1 Head office', '1.1.r1 Male', '1.1.r2 Female', '1.2 College', '1.2.r1 Male', '1.2.r2 Female']);
  const saved = normalizeNodes(schema.nodes);
  assert.equal(saved.error, undefined);
  const parents = hierarchyOf({ nodes: saved.nodes });
  const out = applySubitemSums(parents, { '1.1.r1': 10, '1.1.r2': 7, '1.2.r1': 5, '1.2.r2': 8 });
  assert.deepEqual([out['1.r1'], out['1.r2'], out['1'], out['1.1'], out['1.2']], [15, 15, 30, 17, 13]);
});

test('Split without automatic totals leaves everything to be typed', () => {
  const start = [client.newNode({ title: 'Total', measurement: u, children: [client.newNode({ title: 'A', measurement: u })] })];
  const r = client.splitNode(start, [0], { labels: ['Male', 'Female'], includeSubitems: true, autoSum: false });
  assert.deepEqual(hierarchyOf({ nodes: normalizeNodes(client.treeToSchema(r.nodes).nodes).nodes }), []);
});

test('Split on an item with no sub-items: it is the sum of its rows, the rows are typed', () => {
  const r = client.splitNode([client.newNode({ title: 'Staff' })], [0], { labels: ['Male', 'Female'], measurement: u, autoSum: true });
  const parents = hierarchyOf({ nodes: normalizeNodes(client.treeToSchema(r.nodes).nodes).nodes });
  assert.deepEqual(parents.map((p) => `${p.key}:${p.children.map((c) => c.key)}`), ['1:1.r1,1.r2']);
});

test('Split refuses empty names, a missing measurement, and a second split', () => {
  const t = [client.newNode({ title: 'Total', measurement: u })];
  assert.match(client.splitNode(t, [0], { labels: [' '] }).error, /row name/);
  assert.match(client.splitNode([client.newNode({ title: 'H' })], [0], { labels: ['M'] }).error, /measurement/);
  const once = client.splitNode(t, [0], { labels: ['Male', 'Female'] }).nodes;
  assert.match(client.splitNode(once, [0], { labels: ['male'] }).error, /already has/);
});

// ---- split rows are not numbered: the parent and each child keep their own Male / Female ----
test('rows stay out of the numbering: 1 / 1.1 head office / 1.2 college, each with its own Male and Female', () => {
  const start = [client.newNode({ title: 'Total employee', measurement: u, children: [
    client.newNode({ title: 'Head office', measurement: u }), client.newNode({ title: 'College', measurement: u })] })];
  const r = client.splitNode(start, [0], { labels: ['Male', 'Female'], includeSubitems: true, autoSum: true });
  const rows = client.flattenTree(r.nodes);
  assert.deepEqual(rows.map((x) => `${x.num || '-'} ${x.node.title}`), [
    '1. Total employee', '- Male', '- Female', '1.1. Head office', '- Male', '- Female', '1.2. College', '- Male', '- Female']);
  // the server numbers the saved format the same way, and keeps the row flag
  const saved = normalizeNodes(client.treeToSchema(r.nodes).nodes);
  assert.equal(saved.error, undefined);
  assert.deepEqual(client.formatRows({ nodes: saved.nodes }).map((x) => x.num), ['1.', '', '', '1.1.', '', '', '1.2.', '', '']);
  assert.equal(saved.nodes[0].children[0].row, true);
  // reading it back into the editor keeps the rows as rows
  assert.deepEqual(client.flattenTree(client.schemaToTree({ nodes: saved.nodes })).map((x) => x.code), rows.map((x) => x.code));
});

test('an item with rows is the sum of its rows only (its sub-items are not added on top)', () => {
  const saved = normalizeNodes([{ title: 'Total', measurement: u, sum_of_subitems: true, children: [
    { title: 'Male', measurement: u, row: true }, { title: 'Female', measurement: u, row: true },
    { title: 'Head office', measurement: u }] }]);
  assert.equal(saved.error, undefined);
  assert.deepEqual(hierarchyOf({ nodes: saved.nodes }).map((p) => `${p.key}:${p.children.map((c) => c.key)}`), ['1:1.r1,1.r2']);
  assert.deepEqual(clientChecks.hierarchyOf({ nodes: saved.nodes }).map((p) => `${p.key}:${p.children.map((c) => c.key)}`), ['1:1.r1,1.r2']);
});

test('the server rejects a row at the top level, a row with sub-items and a row without a measurement', () => {
  assert.match(normalizeNodes([{ title: 'Male', measurement: u, row: true }]).error, /under an item/);
  assert.match(normalizeNodes([{ title: 'T', measurement: u, children: [{ title: 'Male', measurement: u, row: true, children: [{ title: 'x', measurement: u }] }] }]).error, /cannot have sub-items/);
  assert.match(normalizeNodes([{ title: 'T', measurement: u, children: [{ title: 'Male', measurement: '', row: true }] }]).error, /needs a measurement/);
});

test('rows never take part in indenting, outdenting or swapping with items', () => {
  const split = client.splitNode([client.newNode({ title: 'T', measurement: u, children: [client.newNode({ title: 'A', measurement: u }), client.newNode({ title: 'B', measurement: u })] })], [0], { labels: ['Male', 'Female'], includeSubitems: false });
  const t = split.nodes; // T: Male, Female, A, B
  assert.equal(client.canIndent(t, [0, 0]), false);  // a row cannot be indented
  assert.equal(client.canIndent(t, [0, 2]), false);  // A has only rows above it
  assert.equal(client.canIndent(t, [0, 3]), true);   // B goes under A, not under Female
  assert.equal(client.canOutdent(t, [0, 0]), false);
  assert.equal(client.canMove(t, [0, 2], -1), false); // A does not swap with Female
  assert.equal(client.canMove(t, [0, 0], 1), true);   // Male <-> Female
  assert.equal(client.belowIndex(t, [0, 0]), 2);      // "add below Male" lands after the last row
  const indented = client.indentNode(t, [0, 3]);
  assert.deepEqual(client.flattenTree(indented).map((x) => x.code), ['1', '1.r1', '1.r2', '1.1', '1.1.1']);
});

// ---- a parent row that is "Sum of sub-items: Yes" gives its sub-items the same rows by itself ----
test('Yes on a parent row creates the same rows under every sub-item, with the parent measurement, and wires the sums', () => {
  let t = [client.newNode({ title: 'Total employee', measurement: u, children: [client.newNode({ title: 'Head office' }), client.newNode({ title: 'College' })] })];
  t = client.splitNode(t, [0], { labels: ['Male', 'Female'], includeSubitems: false }).nodes; // rows typed by hand for now
  assert.deepEqual(client.flattenTree(t).map((x) => x.code), ['1', '1.r1', '1.r2', '1.1', '1.2']);
  t = client.updateNode(t, [0], { sum_of_subitems: true }); // the total is Male + Female
  t = client.syncSplits(client.updateNode(t, [0, 0], { sum_of_subitems: true }));
  t = client.syncSplits(client.updateNode(t, [0, 1], { sum_of_subitems: true }));
  assert.deepEqual(client.flattenTree(t).map((x) => `${x.code} ${x.node.title} ${x.node.measurement}`), [
    '1 Total employee Persons', '1.r1 Male Persons', '1.r2 Female Persons',
    '1.1 Head office Persons', '1.1.r1 Male Persons', '1.1.r2 Female Persons',
    '1.2 College Persons', '1.2.r1 Male Persons', '1.2.r2 Female Persons']);
  assert.deepEqual(client.validateTree(t), {});
  const saved = normalizeNodes(client.treeToSchema(t).nodes);
  assert.equal(saved.error, undefined);
  const out = applySubitemSums(hierarchyOf({ nodes: saved.nodes }), { '1.1.r1': 10, '1.1.r2': 7, '1.2.r1': 5, '1.2.r2': 8 });
  assert.deepEqual([out['1.r1'], out['1.r2'], out['1.1'], out['1.2'], out['1']], [15, 15, 17, 13, 30]);
});

test('a sub-item added later gets the rows automatically; removing one drops it from the sums', () => {
  let t = [client.newNode({ title: 'Total', measurement: u, children: [client.newNode({ title: 'A' })] })];
  t = client.splitNode(t, [0], { labels: ['Male', 'Female'], includeSubitems: true, autoSum: true }).nodes;
  t = client.syncSplits(client.insertNode(t, [0], t[0].children.length, client.newNode({ title: 'B' })));
  assert.deepEqual(client.flattenTree(t).map((x) => x.code), ['1', '1.r1', '1.r2', '1.1', '1.1.r1', '1.1.r2', '1.2', '1.2.r1', '1.2.r2']);
  assert.equal(t[0].children[0].sum_of_ids.length, 2);
  assert.equal(t[0].children[3].measurement, u);
  assert.deepEqual(client.validateTree(t), {});
  t = client.syncSplits(client.removeNode(t, [0, 3])); // remove A
  assert.deepEqual(client.validateTree(t), {});
  assert.equal(t[0].children[0].sum_of_ids.length, 1);
});

test('renaming or re-measuring a parent row carries over to its sub-items rows; a hand-chosen sum is left alone', () => {
  let t = [client.newNode({ title: 'T', measurement: u, children: [client.newNode({ title: 'A' })] })];
  t = client.splitNode(t, [0], { labels: ['Male'], includeSubitems: true, autoSum: true }).nodes;
  t = client.updateRow(t, [0, 0], { title: 'Men', measurement: 'Staff' });
  assert.deepEqual([t[0].children[1].children[0].title, t[0].children[1].children[0].measurement], ['Men', 'Staff']);
  const custom = client.updateNode(t, [0, 0], { sum_of_ids: [t[0]._id] }); // a hand-made choice is not rewired
  assert.deepEqual(client.syncSplits(custom)[0].children[0].sum_of_ids, [t[0]._id]);
});
