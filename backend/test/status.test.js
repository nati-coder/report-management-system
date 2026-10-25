import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITIONS, WOREDA_ONLY, WITH_ZONE, STATUS } from '../src/constants/status.js';

test('every transition target is a known status', () => {
  const known = new Set(Object.values(STATUS));
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(known.has(from), `unknown source ${from}`);
    for (const to of tos) assert.ok(known.has(to), `${from} → unknown ${to}`);
  }
});

test('a team report cannot jump straight to the zone, and an approved report is final', () => {
  assert.ok(TRANSITIONS.draft.includes('pending_woreda'));
  assert.ok(!TRANSITIONS.pending_woreda.includes('submitted'));
  assert.ok(!TRANSITIONS.woreda_approved.includes('approved'));
  assert.deepEqual(TRANSITIONS.approved, []);
});

test('statuses inside the woreda and statuses with the zone never overlap', () => {
  assert.deepEqual(WOREDA_ONLY.filter((s) => WITH_ZONE.includes(s)), []);
});
