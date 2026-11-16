/**
 * Achievement ranking — the pure parts (no database): the averaging rule and the request filters.
 *
 * THE RULE: achievements are never added, they are averaged — SUM(percentages) / COUNT(percentages).
 *   75 and 75 -> 75,  50 and 100 -> 75,  50 and 70 -> 60.
 * A missing value (NULL) is not an item and does not count; nothing to average gives null, never a division by zero.
 * (The SQL in models/AchievementRank.js does the same with SUM(x) / NULLIF(COUNT(x), 0).)
 */
import { ApiError } from './apiResponse.js';
import { ROLES, ZONAL_ROLES, WOREDA_ROLES } from '../constants/roles.js';
import { RANGES, PLAN_MONTHS } from './periods.js';

const r2 = (n) => Math.round(n * 100) / 100;

/** Arithmetic mean of the usable percentages, rounded to 2 decimals, or null when there are none. */
export function meanAchievement(values) {
  const usable = (values || []).filter((v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))).map(Number);
  return usable.length ? r2(usable.reduce((s, v) => s + v, 0) / usable.length) : null;
}

/** Standard "dense" ranking by highest value (ties share a rank, the next rank follows with no gap); null values stay unranked. */
export function denseRank(rows, valueOf) {
  const sorted = [...new Set(rows.map(valueOf).filter((v) => v !== null && v !== undefined))].sort((a, b) => b - a);
  return rows.map((r) => ({ ...r, rank: valueOf(r) == null ? null : sorted.indexOf(valueOf(r)) + 1 }));
}

/** The months a period covers: a month slot, a quarter / half year (q1…q4, h1, h2) or the whole fiscal year. */
export function periodMonths(period = 'annual', month) {
  if (period === 'month') {
    const m = Number(month);
    if (!PLAN_MONTHS.includes(m)) throw ApiError.badRequest('month must be a plan-year month number (Hamle = 7 … Sene = 6)');
    return [m];
  }
  if (!RANGES[period]) throw ApiError.badRequest('period must be month, q1–q4, h1, h2 or annual');
  return RANGES[period].months;
}

const intOrNull = (v, name) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw ApiError.badRequest(`${name} must be a positive whole number`);
  return n;
};

/**
 * Who may rank what, and which filters the query runs with.
 *   zone        admin: chosen with ?zone_id= (required: woredas of different zones are not ranked against each other);
 *               zonal users: their own zone; woreda users: the zone of their woreda (`woredaZoneId`, looked up by the caller).
 *   department  admin: chosen with ?department_id= (required); everyone else: the department on their account.
 *   team        optional ?team_id= (the "by team" woreda ranking).
 *   cap         optional ?cap=100 — an item above target counts as at most `cap` percent (default: no cap).
 */
export function resolveRankFilters(user, q = {}, { woredaZoneId = null } = {}) {
  const year = intOrNull(q.year, 'year');
  if (!year) throw ApiError.badRequest('year is required');
  const months = periodMonths(q.period || 'annual', q.month);

  let zoneId;
  if (user.role === ROLES.ADMIN) zoneId = q.zone_id || null;
  else if (ZONAL_ROLES.includes(user.role)) zoneId = user.zone_id || null;
  else if (WOREDA_ROLES.includes(user.role)) zoneId = woredaZoneId;
  else zoneId = null;
  if (!zoneId) throw ApiError.badRequest(user.role === ROLES.ADMIN ? 'zone_id is required' : 'Your account has no zone');
  if (user.role !== ROLES.ADMIN && q.zone_id && q.zone_id !== zoneId) throw ApiError.forbidden('Outside your administrative scope');

  let departmentId;
  if (user.role === ROLES.ADMIN) departmentId = intOrNull(q.department_id, 'department_id');
  else {
    departmentId = user.department_id || null;
    const asked = intOrNull(q.department_id, 'department_id');
    if (asked && asked !== departmentId) throw ApiError.forbidden('Outside your department');
  }
  if (!departmentId) throw ApiError.badRequest(user.role === ROLES.ADMIN ? 'department_id is required' : 'Your account has no department');

  let cap = null;
  if (q.cap !== undefined && q.cap !== '') {
    cap = Number(q.cap);
    if (!Number.isFinite(cap) || cap <= 0 || cap > 1000) throw ApiError.badRequest('cap must be a number between 0 and 1000');
  }
  return { year, months, period: q.period || 'annual', zoneId, departmentId, teamId: intOrNull(q.team_id, 'team_id'), cap };
}
