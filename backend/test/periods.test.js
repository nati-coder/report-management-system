import test from 'node:test';
import assert from 'node:assert/strict';
import { monthsOf, PLAN_MONTHS, RANGES } from '../src/utils/periods.js';

test('rankings look at the monthly reports of the months they cover', () => {
  assert.deepEqual(monthsOf({ period_type: 'monthly', month: 9 }), [9]);
  assert.deepEqual(monthsOf({ period_type: 'quarterly', quarter: 2 }), RANGES.q2.months);
  assert.deepEqual(monthsOf({ period_type: 'quarterly' }), PLAN_MONTHS);
  assert.deepEqual(monthsOf({ period_type: 'annual' }), PLAN_MONTHS);
});

test('quarters partition the fiscal year', () => {
  const all = ['q1', 'q2', 'q3', 'q4'].flatMap((q) => RANGES[q].months);
  assert.deepEqual([...all].sort((a, b) => a - b), [...PLAN_MONTHS].sort((a, b) => a - b));
});
