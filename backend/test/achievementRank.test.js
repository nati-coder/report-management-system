import test from 'node:test';
import assert from 'node:assert/strict';
import { meanAchievement, denseRank, periodMonths, resolveRankFilters } from '../src/utils/achievementRank.js';
import { OVERALL_WOREDA_SQL, WOREDA_BY_TEAM_SQL, ZONAL_TEAM_SQL } from '../src/models/achievementRankSql.js';
import { ROLES } from '../src/constants/roles.js';

test('achievements are averaged, never added: 75+75=75, 50+100=75, 50+70=60', () => {
  assert.equal(meanAchievement([75, 75]), 75);
  assert.equal(meanAchievement([50, 100]), 75);
  assert.equal(meanAchievement([50, 70]), 60);
});

test('a missing value is not an item, and nothing to average is null (no division by zero)', () => {
  assert.equal(meanAchievement([50, null, undefined, '']), 50);
  assert.equal(meanAchievement([0, 100]), 50);       // a real 0 % counts
  assert.equal(meanAchievement([]), null);
  assert.equal(meanAchievement([null]), null);
});

test('dense ranking: highest first, ties share a rank with no gap after, empty stays unranked', () => {
  const r = denseRank([{ n: 'C', v: 75 }, { n: 'D', v: 60 }, { n: 'E', v: 75 }, { n: 'F', v: 40 }, { n: 'G', v: null }], (x) => x.v);
  assert.deepEqual(r.map((x) => `${x.n}:${x.rank}`), ['C:1', 'D:2', 'E:1', 'F:3', 'G:null']);
});

test('the worked example: Woreda C vs D, Team A vs B, and the zone-level team rank', () => {
  const A = { C: 80, D: 60 }; const B = { C: 70, D: 90 };
  // 1. overall woreda rank = mean of its teams
  const overall = denseRank(['C', 'D'].map((w) => ({ w, v: meanAchievement([A[w], B[w]]) })), (x) => x.v);
  assert.deepEqual(overall.map((x) => `${x.w}:${x.v}:${x.rank}`), ['C:75:1', 'D:75:1']); // 75 = 75: a tie, both first
  // 2. by team: Team A -> C first; Team B -> D first
  assert.deepEqual(denseRank(['C', 'D'].map((w) => ({ w, v: A[w] })), (x) => x.v).map((x) => x.rank), [1, 2]);
  assert.deepEqual(denseRank(['C', 'D'].map((w) => ({ w, v: B[w] })), (x) => x.v).map((x) => x.rank), [2, 1]);
  // 3. zone-level team rank = mean of the team across woredas
  assert.deepEqual(denseRank([{ t: 'A', v: meanAchievement([A.C, A.D]) }, { t: 'B', v: meanAchievement([B.C, B.D]) }], (x) => x.v).map((x) => `${x.t}:${x.v}:${x.rank}`), ['A:70:2', 'B:80:1']);
});

test('periods: a month, a quarter, a half year, the whole year', () => {
  assert.deepEqual(periodMonths('month', 9), [9]);
  assert.deepEqual(periodMonths('q2'), [10, 11, 12]);
  assert.equal(periodMonths('annual').length, 12);
  assert.throws(() => periodMonths('month', 13), /month/);
  assert.throws(() => periodMonths('weekly'), /period/);
});

const zonalHead = { role: ROLES.ZONAL_DEPT_HEAD, zone_id: 'Z1', department_id: 4 };
test('a zonal user is held to their own zone and department', () => {
  const f = resolveRankFilters(zonalHead, { year: '2018', period: 'q1', team_id: '9' });
  assert.deepEqual([f.zoneId, f.departmentId, f.teamId, f.months, f.cap], ['Z1', 4, 9, [7, 8, 9], null]);
  assert.throws(() => resolveRankFilters(zonalHead, { year: 2018, zone_id: 'Z2' }), /administrative scope/);
  assert.throws(() => resolveRankFilters(zonalHead, { year: 2018, department_id: 5 }), /department/);
  assert.throws(() => resolveRankFilters({ ...zonalHead, department_id: null }, { year: 2018 }), /no department/);
});

test('a woreda user ranks within the zone of their woreda; the admin must choose a zone and a department', () => {
  const woreda = { role: ROLES.WOREDA_DEPT_HEAD, woreda_id: 'W1', department_id: 4 };
  assert.equal(resolveRankFilters(woreda, { year: 2018 }, { woredaZoneId: 'Z1' }).zoneId, 'Z1');
  assert.throws(() => resolveRankFilters(woreda, { year: 2018 }), /no zone/);
  const admin = { role: ROLES.ADMIN };
  assert.throws(() => resolveRankFilters(admin, { year: 2018 }), /zone_id is required/);
  assert.throws(() => resolveRankFilters(admin, { year: 2018, zone_id: 'Z1' }), /department_id is required/);
  assert.equal(resolveRankFilters(admin, { year: 2018, zone_id: 'Z1', department_id: 4, cap: 100 }).cap, 100);
});

test('bad input is refused', () => {
  assert.throws(() => resolveRankFilters(zonalHead, {}), /year is required/);
  assert.throws(() => resolveRankFilters(zonalHead, { year: 2018, team_id: 'x' }), /team_id/);
  assert.throws(() => resolveRankFilters(zonalHead, { year: 2018, cap: '-5' }), /cap/);
});

test('the three queries use AVG-style SUM/COUNT with a safe divisor and DENSE_RANK, and reference every parameter', () => {
  for (const sql of [OVERALL_WOREDA_SQL, WOREDA_BY_TEAM_SQL, ZONAL_TEAM_SQL]) {
    assert.match(sql, /DENSE_RANK\(\) OVER \(/);
    assert.match(sql, /SUM\(pct\) \/ NULLIF\(COUNT\(pct\), 0\)/);
    for (const p of ['$1', '$2', '$3', '$4', '$5', '$6']) assert.ok(sql.includes(p), `${p} is used`);
    assert.doesNotMatch(sql, /\$7/);
  }
  assert.match(OVERALL_WOREDA_SQL, /SUM\(ta\.achievement\) \/ NULLIF\(COUNT\(ta\.achievement\), 0\)/);
  assert.match(WOREDA_BY_TEAM_SQL, /PARTITION BY team_id ORDER BY achievement DESC/);
  assert.match(ZONAL_TEAM_SQL, /SUM\(ta\.achievement\) \/ NULLIF\(COUNT\(ta\.achievement\), 0\)/);
});
