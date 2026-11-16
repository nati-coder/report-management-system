import { query } from '../../config/db.js';
import { OVERALL_WOREDA_SQL, WOREDA_BY_TEAM_SQL, ZONAL_TEAM_SQL } from './achievementRankSql.js';

/** Runs the three ranking queries (the SQL and how achievement is worked out are explained in achievementRankSql.js). */
const params = (f) => [f.year, f.months, f.zoneId, f.departmentId, f.teamId ?? null, f.cap ?? null];
const run = async (sql, f) => (await query(sql, params(f))).rows.map((r) => ({ ...r, achievement: r.achievement === null ? null : Number(r.achievement) }));

const AchievementRank = {
  overallWoredas: (f) => run(OVERALL_WOREDA_SQL, { ...f, teamId: null }), // overall = all teams of the department
  woredasByTeam: (f) => run(WOREDA_BY_TEAM_SQL, f),
  zonalTeams: (f) => run(ZONAL_TEAM_SQL, { ...f, teamId: null }),
};
export default AchievementRank;
