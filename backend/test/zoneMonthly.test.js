import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// planTable.js imports download.js, which needs the browser-only axios client; stub just that module so the
// real planTable code can be tested here.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier === './download.js') {
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent("export const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); export const saveBlob = () => {}; export const blobErrorMessage = async () => '';") };
    }
    return next(specifier, context);
  }
`));
const { zoneMonthlyValues } = await import('../../frontend/src/utils/zoneMonthly.js');
const { zoneMonthlyPlanTable } = await import('../../frontend/src/utils/planTable.js');
import { indicatorsOf } from '../src/utils/formatTree.js';
import { schema } from './helpers.js';

const items = indicatorsOf(schema); // 1 Immunization, 1.1, 1.2 (persons), 2 Coverage (%), 3.1 Sessions
const row = (woreda_id, month, data, status = 'submitted') => ({ woreda_id, month, data, status });

test('a count of the zone is the sum of its woredas, month by month (Hamle first)', () => {
  const rows = [
    row('w1', 7, { 1: 10, '1.1': 4, '1.2': 6 }), row('w2', 7, { 1: 5, '1.1': 5, '1.2': 0 }),
    row('w1', 8, { 1: 20 }),
  ];
  const { values, woredasCounted } = zoneMonthlyValues(items, rows, ['w1', 'w2']);
  assert.equal(values['1'][0], '15');   // Hamle = slot 7 = first
  assert.equal(values['1'][1], '20');   // Nehase
  assert.equal(values['1'][2], '');     // nothing yet for Meskerem
  assert.equal(values['1.1'][0], '9');
  assert.equal(woredasCounted, 2);
});

test('a percentage is a rate: averaged, not added', () => {
  const rows = [row('w1', 7, { 2: 80 }), row('w2', 7, { 2: 90 })];
  assert.equal(zoneMonthlyValues(items, rows, ['w1', 'w2']).values['2'][0], '85');
});

test('drafts and other zones do not count', () => {
  const rows = [row('w1', 7, { 1: 10 }, 'draft'), row('w2', 7, { 1: 7 }), row('other', 7, { 1: 100 })];
  const { values, woredasCounted } = zoneMonthlyValues(items, rows, ['w1', 'w2']);
  assert.equal(values['1'][0], '7');
  assert.equal(woredasCounted, 1);
});

test('the months after the calendar turns come out in plan-year order', () => {
  const rows = [row('w1', 1, { 1: 3 }), row('w1', 6, { 1: 9 })];     // Tir (slot 1) is 7th, Sene (slot 6) is 12th
  const { values } = zoneMonthlyValues(items, rows, ['w1']);
  assert.equal(values['1'][6], '3');
  assert.equal(values['1'][11], '9');
});

test('the export table lists only items the zone plan covers, with total and what is left', () => {
  const rows = [row('w1', 7, { 1: 10 }), row('w1', 8, { 1: 20 })];
  const { values, woredasCounted } = zoneMonthlyValues(items, rows, ['w1', 'w2']);
  const format = { template_title: 'Health', version_name: 'V', version_year: 2019, team_name: 'MCH', version: 1 };
  const t = zoneMonthlyPlanTable({ format, year: 2019, zoneName: 'Z', items, zoneData: { 1: 100 }, values, woredasCounted, woredasTotal: 2 });
  assert.equal(t.rows.length, 1);
  const cells = t.rows[0].cells;
  assert.equal(cells.length, t.columns.length);
  assert.deepEqual([cells[3], cells[4], cells[5]], [100, 10, 20]);       // zone annual, Hamle, Nehase
  assert.deepEqual(cells.slice(-2), [30, 70]);                           // total placed, left
  assert.match(t.lines.join(' '), /1 of 2 woredas/);
});
