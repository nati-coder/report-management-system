import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNodes } from '../src/utils/formatTree.js';
import { hierarchyOf, hierarchyErrors, applySubitemSums } from '../src/utils/planChecks.js';

const leaf = (title, measurement = 'Persons', extra = {}) => ({ title, measurement, ...extra });

test('every saved item carries an explicit Yes / No, defaulting to No', () => {
  const { nodes } = normalizeNodes([leaf('A', 'Persons', { children: [leaf('A1')] }), leaf('B')]);
  assert.equal(nodes[0].sum_of_subitems, false);
  assert.equal(nodes[1].sum_of_subitems, false);
});

test('"Yes" is kept when the item really is a sum of its sub-items', () => {
  const { nodes, error } = normalizeNodes([leaf('A', 'Persons', { sum_of_subitems: true, children: [leaf('A1'), leaf('A2')] })]);
  assert.equal(error, undefined);
  assert.equal(nodes[0].sum_of_subitems, true);
});

test('"Yes" looks through headings to the nearest measured sub-items', () => {
  const { error } = normalizeNodes([leaf('A', 'Persons', { sum_of_subitems: true, children: [leaf('Group', '', { children: [leaf('A1')] })] })]);
  assert.equal(error, undefined);
});

test('"Yes" is refused where there is nothing to sum', () => {
  const noKids = normalizeNodes([leaf('A', 'Persons', { sum_of_subitems: true })]);
  assert.match(noKids.error, /Item 1: .*at least one sub-item/);
  const heading = normalizeNodes([leaf('A', '', { sum_of_subitems: true, children: [leaf('A1')] })]);
  assert.match(heading.error, /heading/);
  const pct = normalizeNodes([leaf('A', '%', { sum_of_subitems: true, children: [leaf('A1', '%')] })]);
  assert.match(pct.error, /percentage/);
  const mixed = normalizeNodes([leaf('A', 'Persons', { sum_of_subitems: true, children: [leaf('A1', 'ETB')] })]);
  assert.match(mixed.error, /same measurement/);
});

test('the Yes / No value must be a boolean', () => {
  assert.match(normalizeNodes([leaf('A', 'Persons', { sum_of_subitems: 'yes' })]).error, /Yes or No/);
});

const fmt = (flag) => ({ nodes: [
  { code: '1', title: 'A', measurement: 'Persons', ...(flag === undefined ? {} : { sum_of_subitems: flag }), children: [
    { code: '1.1', title: 'A1', measurement: 'Persons', sum_of_subitems: false, children: [] },
    { code: '1.2', title: 'A2', measurement: 'Persons', sum_of_subitems: false, children: [] },
  ] },
] });

test('only items marked Yes are sums; No means a stand-alone, hand-entered value', () => {
  assert.deepEqual(hierarchyOf(fmt(true)).map((p) => p.key), ['1']);
  assert.deepEqual(hierarchyOf(fmt(false)).map((p) => p.key), []);
});

test('a format saved before the flag existed keeps the old rule', () => {
  assert.deepEqual(hierarchyOf(fmt(undefined)).map((p) => p.key), ['1']);
});

test('a "No" item is never checked against its sub-items', () => {
  assert.deepEqual(hierarchyErrors(hierarchyOf(fmt(false)), { 1: 99, '1.1': 4, '1.2': 6 }), []);
});

test('the server calculates the sum, whatever the client sent', () => {
  const parents = hierarchyOf(fmt(true));
  assert.deepEqual(applySubitemSums(parents, { 1: 99, '1.1': 4, '1.2': 6 }), { 1: 10, '1.1': 4, '1.2': 6 });
  assert.equal(applySubitemSums(parents, { '1.1': 4 })[1], 4);              // parent missing: filled in
  assert.deepEqual(applySubitemSums(parents, { 1: 99 }), { 1: 99 });        // no sub-item has a value yet: untouched
  assert.deepEqual(hierarchyErrors(parents, applySubitemSums(parents, { 1: 99, '1.1': 4, '1.2': 6 })), []);
});

test('a sum of sums works from the bottom up', () => {
  const schema = { nodes: [{ code: '1', title: 'T', measurement: 'N', sum_of_subitems: true, children: [
    { code: '1.1', title: 'M', measurement: 'N', sum_of_subitems: true, children: [
      { code: '1.1.1', title: 'x', measurement: 'N', sum_of_subitems: false, children: [] },
      { code: '1.1.2', title: 'y', measurement: 'N', sum_of_subitems: false, children: [] },
    ] },
    { code: '1.2', title: 'z', measurement: 'N', sum_of_subitems: false, children: [] },
  ] }] };
  const out = applySubitemSums(hierarchyOf(schema), { '1.1.1': 1, '1.1.2': 2, '1.2': 4 });
  assert.equal(out['1.1'], 3);
  assert.equal(out['1'], 7);
});
