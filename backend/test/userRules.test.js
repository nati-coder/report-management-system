import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPlacement, withTeamRule, TEAMLESS_ROLES, TEAM_REQUIRED_ROLES, needsDepartment } from '../src/utils/userRules.js';
import { ROLES } from '../src/constants/roles.js';

const zonal = { zone_id: 'Z1', woreda_id: null, department_id: 1, team_id: null };
const woreda = { zone_id: 'Z1', woreda_id: 'W1', department_id: 1, team_id: null };

test('a department is required for every role except the admin', () => {
  assert.equal(needsDepartment(ROLES.ADMIN), false);
  for (const role of Object.values(ROLES).filter((r) => r !== ROLES.ADMIN)) {
    const base = role.startsWith('zonal') ? zonal : woreda;
    const team = TEAM_REQUIRED_ROLES.includes(role) ? 5 : null;
    assert.doesNotThrow(() => checkPlacement({ ...base, role, team_id: team }), role);
    assert.throws(() => checkPlacement({ ...base, role, team_id: team, department_id: null }), /department is required/, role);
  }
});

test('department heads and plan experts (zonal and woreda) have no team', () => {
  assert.deepEqual([...TEAMLESS_ROLES].sort(), [ROLES.WOREDA_DEPT_HEAD, ROLES.WOREDA_PLAN_EXPERT, ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_PLAN_EXPERT].sort());
  for (const role of TEAMLESS_ROLES) {
    assert.equal(withTeamRule({ role, team_id: 7 }).team_id, null, role);
    assert.doesNotThrow(() => checkPlacement(withTeamRule({ ...(role.startsWith('zonal') ? zonal : woreda), role, team_id: 7 })), role);
  }
});

test('experts and team leaders still need a team, and keep it', () => {
  for (const role of TEAM_REQUIRED_ROLES) {
    const base = role.startsWith('zonal') ? zonal : woreda;
    assert.throws(() => checkPlacement({ ...base, role }), /team is required/, role);
    assert.equal(withTeamRule({ ...base, role, team_id: 7 }).team_id, 7, role);
  }
});

test('zone and woreda placement rules are unchanged', () => {
  assert.throws(() => checkPlacement({ ...woreda, role: ROLES.WOREDA_DEPT_HEAD, woreda_id: null }), /woreda_id is required/);
  assert.throws(() => checkPlacement({ ...zonal, role: ROLES.ZONAL_DEPT_HEAD, zone_id: null }), /zone_id is required/);
  assert.throws(() => checkPlacement({ ...zonal, role: ROLES.ZONAL_DEPT_HEAD, woreda_id: 'W1' }), /cannot be assigned to a woreda/);
});
