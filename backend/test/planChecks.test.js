import test from 'node:test';
import assert from 'node:assert/strict';
import { hierarchyOf, hierarchyErrors, zoneTotalErrors, monthlyTotalErrors } from '../src/utils/planChecks.js';
import { indicatorsOf } from '../src/utils/formatTree.js';
import { schema } from './helpers.js';

const parents = hierarchyOf(schema);
const indicators = indicatorsOf(schema);

test('only measured parents with measured sub-items of the same measurement are checked', () => {
  assert.deepEqual(parents.map((p) => p.key), ['1']); // 2 is a %, 3 is a heading
});

test('a parent must equal the sum of its sub-items', () => {
  assert.deepEqual(hierarchyErrors(parents, { 1: 10, '1.1': 4, '1.2': 6 }), []);
  assert.equal(hierarchyErrors(parents, { 1: 11, '1.1': 4, '1.2': 6 }).length, 1);
  assert.equal(hierarchyErrors(parents, { '1.1': 4, '1.2': 6 }).length, 1); // parent missing
  assert.deepEqual(hierarchyErrors(parents, { 1: 99 }), []);                 // no sub-item has a value yet
});

test('decimal noise is tolerated', () => {
  assert.deepEqual(hierarchyErrors(parents, { 1: 0.3, '1.1': 0.1, '1.2': 0.2 }), []);
});

test('woreda targets may not exceed the zone plan, and must match it once every woreda is planned', () => {
  const zoneData = { 1: 100, 2: 80 };
  const over = zoneTotalErrors({ indicators, zoneData, plans: [{ data: { 1: 70 } }, { data: { 1: 40 } }], complete: false });
  assert.equal(over.length, 1);
  const short = zoneTotalErrors({ indicators, zoneData, plans: [{ data: { 1: 70 } }, { data: { 1: 20 } }], complete: true });
  assert.equal(short.length, 1);
  assert.deepEqual(zoneTotalErrors({ indicators, zoneData, plans: [{ data: { 1: 70 } }, { data: { 1: 30 } }], complete: true }), []);
});

test('percentages are rates: never summed', () => {
  const zoneData = { 2: 80 };
  assert.deepEqual(zoneTotalErrors({ indicators, zoneData, plans: [{ data: { 2: 90 } }, { data: { 2: 95 } }], complete: true }), []);
});

test('a woreda cannot be planned for an item the zone plan lacks', () => {
  const errs = zoneTotalErrors({ indicators, zoneData: { 1: 10 }, plans: [{ data: { '1.1': 5 } }], complete: false });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /not part of the zone plan/);
});

test('twelve months must add up to the annual plan', () => {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, data: { 1: 10 } }));
  assert.deepEqual(monthlyTotalErrors({ indicators, annualData: { 1: 120 }, months, complete: true }), []);
  assert.equal(monthlyTotalErrors({ indicators, annualData: { 1: 130 }, months, complete: true }).length, 1);
  assert.equal(monthlyTotalErrors({ indicators, annualData: { 1: 100 }, months, complete: false }).length, 1);
});
