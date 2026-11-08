import test from 'node:test';
import assert from 'node:assert/strict';
import { availablePeriods } from '../../frontend/src/utils/periods.js';
import { currentFiscalMonth, currentFiscalYear } from '../src/utils/ethiopianDate.js';

const at = (iso) => new Date(`${iso}T12:00:00Z`);
const NOV_8_2026 = at('2026-11-08'); // Tikimt 29, 2019 EC — fiscal year 2019, slot 10
const names = (xs) => xs.map((x) => x.label.split(' (')[0]);

test('the current fiscal month is worked out from the Ethiopian calendar', () => {
  assert.equal(currentFiscalYear(NOV_8_2026), 2019);
  assert.equal(currentFiscalMonth(NOV_8_2026), 10);            // Tikimt
  assert.equal(currentFiscalMonth(at('2026-07-10')), 7);       // Hamle
  assert.equal(currentFiscalMonth(at('2026-09-06')), 8);       // Pagume counts with Nehase
  assert.equal(currentFiscalMonth(at('2026-09-20')), 9);       // Meskerem
  assert.equal(currentFiscalMonth(at('2027-06-30')), 6);       // Sene
});

test('reports up to Tikimt: months to Tikimt, quarter 1 and 2, half year 1 and annual — nothing later', () => {
  const p = availablePeriods({ year: 2019, reportedMonths: [7, 8, 9, 10], now: NOV_8_2026 });
  assert.deepEqual(p.months.map((m) => m.value), [7, 8, 9, 10]);
  assert.deepEqual(p.ranges.map((r) => r.value), ['q1', 'q2', 'h1', 'annual']);
  assert.equal(p.upTo, 'Tikimt');
  assert.ok(p.ranges.find((r) => r.value === 'q2').label.endsWith('up to Tikimt'));   // only partly over
  assert.ok(p.ranges.find((r) => r.value === 'h1').label.endsWith('up to Tikimt'));
  assert.ok(!p.ranges.find((r) => r.value === 'q1').label.includes('up to'));          // complete
});

test('never past the current month, even if a later month somehow has a report', () => {
  const p = availablePeriods({ year: 2019, reportedMonths: [7, 8, 9, 10, 11, 12], now: NOV_8_2026 });
  assert.equal(p.months.at(-1).value, 10);
});

test('the list stops at the last reported month, which may be before the current one', () => {
  const p = availablePeriods({ year: 2019, reportedMonths: [7, 8], now: NOV_8_2026 });
  assert.deepEqual(names(p.months), ['Hamle', 'Nehase']);
  assert.deepEqual(p.ranges.map((r) => r.value), ['q1', 'h1', 'annual']);
});

test('with no reports yet the list runs up to the current month', () => {
  const p = availablePeriods({ year: 2019, reportedMonths: [], now: NOV_8_2026 });
  assert.deepEqual(p.months.map((m) => m.value), [7, 8, 9, 10]);
});

test('a past year offers everything, a future year nothing', () => {
  const past = availablePeriods({ year: 2018, reportedMonths: [], now: NOV_8_2026 });
  assert.equal(past.months.length, 12);
  assert.equal(past.ranges.length, 7);
  assert.ok(past.ranges.every((r) => !r.label.includes('up to')));
  const future = availablePeriods({ year: 2020, reportedMonths: [7], now: NOV_8_2026 });
  assert.deepEqual([future.months.length, future.ranges.length], [0, 0]);
});

test('months after the year turns are ordered by the fiscal year, not the calendar year', () => {
  const p = availablePeriods({ year: 2019, reportedMonths: [7, 8, 9, 10, 11, 12, 1, 2], now: at('2027-03-01') }); // Yekatit
  assert.deepEqual(p.months.map((m) => m.value), [7, 8, 9, 10, 11, 12, 1, 2]);
  assert.deepEqual(p.ranges.map((r) => r.value), ['q1', 'q2', 'q3', 'h1', 'h2', 'annual']);
});
