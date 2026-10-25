import test from 'node:test';
import assert from 'node:assert/strict';
import { templateScope, woredaPlanScope, inScope, canManageReport } from '../src/utils/scope.js';
import { ROLES } from '../src/constants/roles.js';

const fmt = (department_id, team_id) => ({ department_id, team_id });

test('a zonal expert is confined to their department AND team', () => {
  const s = templateScope({ role: ROLES.ZONAL_EXPERT, department_id: 1, team_id: 5 });
  assert.ok(inScope(s, fmt(1, 5)));
  assert.ok(!inScope(s, fmt(1, 6)));
  assert.ok(!inScope(s, fmt(2, 5)));
});

test('a zonal plan expert / dept head see the whole department', () => {
  for (const role of [ROLES.ZONAL_PLAN_EXPERT, ROLES.ZONAL_DEPT_HEAD]) {
    const s = templateScope({ role, department_id: 1, team_id: 5 });
    assert.ok(inScope(s, fmt(1, 5)) && inScope(s, fmt(1, 6)));
    assert.ok(!inScope(s, fmt(2, 5)));
  }
});

test('a zonal user without a department sees nothing', () => {
  assert.equal(inScope(templateScope({ role: ROLES.ZONAL_EXPERT }), fmt(1, 5)), false);
});

test('woreda users are scoped like plans: department, and team for experts and team leaders', () => {
  const expert = woredaPlanScope({ role: ROLES.WOREDA_EXPERT, department_id: 1, team_id: 5 });
  assert.ok(inScope(expert, fmt(1, 5)) && !inScope(expert, fmt(1, 6)));
  const head = woredaPlanScope({ role: ROLES.WOREDA_DEPT_HEAD, department_id: 1 });
  assert.ok(inScope(head, fmt(1, 6)) && !inScope(head, fmt(2, 6)));
  assert.equal(woredaPlanScope({ role: ROLES.WOREDA_EXPERT }), null);
});

test('who may submit / edit / delete a woreda report', () => {
  const report = { created_by: 10 };
  assert.ok(canManageReport({ id: 10, role: ROLES.WOREDA_EXPERT }, report));       // the author
  assert.ok(!canManageReport({ id: 11, role: ROLES.WOREDA_EXPERT }, report));      // a colleague
  assert.ok(!canManageReport({ id: 12, role: ROLES.WOREDA_PLAN_EXPERT }, report)); // reviews, does not file for others
  assert.ok(canManageReport({ id: 13, role: ROLES.WOREDA_TEAM_LEADER }, report));
  assert.ok(canManageReport({ id: 14, role: ROLES.WOREDA_DEPT_HEAD }, report));
  assert.ok(canManageReport({ id: 1, role: ROLES.ADMIN }, report));
});
