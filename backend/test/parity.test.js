// The frontend keeps copies of a few backend helpers. These tests fail if the copies drift apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hierarchyOf as serverHierarchy } from '../src/utils/planChecks.js';
import { hierarchyOf as clientHierarchy } from '../../frontend/src/utils/planChecks.js';
import { indicatorsOf as serverIndicators } from '../src/utils/formatTree.js';
import { indicatorsOf as clientIndicators } from '../../frontend/src/utils/formatTree.js';
import { schema } from './helpers.js';

test('ethiopianDate.js is identical on both sides', () => {
  const a = fs.readFileSync(new URL('../src/utils/ethiopianDate.js', import.meta.url), 'utf8');
  const b = fs.readFileSync(new URL('../../frontend/src/utils/ethiopianDate.js', import.meta.url), 'utf8');
  assert.equal(a, b);
});

test('the client and the server find the same summable parents', () => {
  const keys = (ps) => ps.map((p) => `${p.key}:${p.children.map((c) => c.key).join(',')}`);
  assert.deepEqual(keys(clientHierarchy(schema)), keys(serverHierarchy(schema)));
});

test('the client and the server find the same measured items', () => {
  const pick = (xs) => xs.map((i) => `${i.key}|${i.measurement}|${i.isPercent}`);
  assert.deepEqual(pick(clientIndicators(schema)), pick(serverIndicators(schema)));
});

test('monthly and annual templates are both reported month by month — on both sides', async () => {
  const { filedMonthly: server } = await import('../src/utils/periods.js');
  const { filedMonthly: client } = await import('../../frontend/src/utils/periods.js');
  for (const type of ['monthly', 'annual', 'quarterly', undefined]) assert.equal(client(type), server(type), String(type));
  assert.equal(server('monthly'), true);   // a reporting period can be opened for a monthly format
  assert.equal(server('quarterly'), false);
});

test('the client and the server agree on which items are sums of sub-items (Yes / No / saved before the flag)', () => {
  const keys = (ps) => ps.map((p) => `${p.key}:${p.children.map((c) => c.key).join(',')}`).sort();
  const leaf = (code, flag) => ({ code, title: code, measurement: 'Persons', ...(flag === undefined ? {} : { sum_of_subitems: flag }), children: [] });
  const variant = (flag) => ({ nodes: [
    { ...leaf('1', flag), children: [leaf('1.1', false), leaf('1.2', false)] },
    { ...leaf('2', flag), children: [{ code: '2.1', title: 'h', measurement: '', children: [leaf('2.1.1', false)] }] },
    { ...leaf('3', true), measurement: '%', children: [{ ...leaf('3.1', false), measurement: '%' }] }, // a % is never a sum
  ] });
  for (const flag of [true, false, undefined]) {
    assert.deepEqual(keys(clientHierarchy(variant(flag))), keys(serverHierarchy(variant(flag))), String(flag));
  }
  assert.deepEqual(keys(serverHierarchy(variant(true))), ['1:1.1,1.2', '2:2.1.1']);
  assert.deepEqual(keys(serverHierarchy(variant(false))), []);
});
