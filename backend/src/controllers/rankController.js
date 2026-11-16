import AchievementRank from '../models/AchievementRank.js';
import catchAsync from '../utils/catchAsync.js';
import { success, ApiError } from '../utils/apiResponse.js';
import { resolveRankFilters } from '../utils/achievementRank.js';
import { WOREDA_ROLES } from '../constants/roles.js';
import { query } from '../../config/db.js';

/** Filters for this request: admin picks the zone / department, everyone else is held to their own (see resolveRankFilters). */
async function filtersFor(req) {
  let woredaZoneId = null;
  if (WOREDA_ROLES.includes(req.user.role) && req.user.woreda_id) {
    woredaZoneId = (await query('SELECT zone_id FROM woredas WHERE woreda_id = $1', [req.user.woreda_id])).rows[0]?.zone_id ?? null;
  }
  const f = resolveRankFilters(req.user, req.query, { woredaZoneId });
  if (f.teamId) { // a team filter must be a team of that department
    const { rows } = await query('SELECT 1 FROM teams WHERE id = $1 AND department_id = $2', [f.teamId, f.departmentId]);
    if (!rows.length) throw ApiError.badRequest('That team is not in this department');
  }
  return f;
}
const echo = (f) => ({ year: f.year, period: f.period, months: f.months, zone_id: f.zoneId, department_id: f.departmentId, team_id: f.teamId, cap: f.cap });

/** GET /rank/woredas?mode=overall|team  — Woreda Rank tab. */
export const woredaRank = catchAsync(async (req, res) => {
  const mode = req.query.mode === 'team' ? 'team' : 'overall';
  const f = await filtersFor(req);
  const rows = mode === 'team' ? await AchievementRank.woredasByTeam(f) : await AchievementRank.overallWoredas(f);
  success(res, { mode, filters: echo(f), rows });
});

/** GET /rank/teams  — Team Rank tab (teams of the department compared across the zone). */
export const teamRank = catchAsync(async (req, res) => {
  const f = await filtersFor(req);
  success(res, { mode: 'teams', filters: echo(f), rows: await AchievementRank.zonalTeams(f) });
});
