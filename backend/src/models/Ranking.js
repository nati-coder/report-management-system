import { query, withTransaction } from '../../config/db.js';

const Ranking = {
  async addTeamFeedback(f, userId) {
    const { rows } = await query(
      `INSERT INTO team_feedback (report_id, team_id, scored_by, score, max_score, feedback)
       SELECT $1, r.team_id, $2, $3, $4, $5 FROM reports r WHERE r.id = $1 RETURNING *`,
      [f.report_id, userId, f.score, f.max_score ?? 100, f.feedback ?? null]);
    return rows[0] || null;
  },
  async replaceTeamRanking({ woreda_id, period_type, year, month, quarter }, ranked) {
    return withTransaction(async (c) => {
      await c.query(
        `DELETE FROM team_ranking WHERE woreda_id=$1 AND period_type=$2 AND year=$3
           AND month IS NOT DISTINCT FROM $4 AND quarter IS NOT DISTINCT FROM $5`,
        [woreda_id, period_type, year, month ?? null, quarter ?? null]);
      const out = [];
      for (const r of ranked) {
        const { rows } = await c.query(
          `INSERT INTO team_ranking (woreda_id, period_type, year, month, quarter, team_id, total_score, rank)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [woreda_id, period_type, year, month ?? null, quarter ?? null, r.team_id, r.total_score, r.rank]);
        out.push(rows[0]);
      }
      return out;
    });
  },
  async listTeamRanking({ woreda_id, period_type, year, month, quarter }) {
    const { rows } = await query(
      `SELECT tr.*, t.name AS team_name FROM team_ranking tr JOIN teams t ON t.id = tr.team_id
       WHERE tr.woreda_id=$1 AND tr.period_type=$2 AND tr.year=$3
         AND ($4::int IS NULL OR tr.month=$4) AND ($5::int IS NULL OR tr.quarter=$5)
       ORDER BY tr.rank`,
      [woreda_id, period_type, year, month ?? null, quarter ?? null]);
    return rows;
  },
  async upsertWoredaRank(r, userId) {
    return withTransaction(async (c) => {
      await c.query('DELETE FROM woreda_ranking WHERE woreda_id=$1 AND year=$2 AND period_type=$3',
        [r.woreda_id, r.year, r.period_type]);
      const { rows } = await c.query(
        `INSERT INTO woreda_ranking (woreda_id, year, period_type, total_score, overall_rank, manual_feedback, assigned_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [r.woreda_id, r.year, r.period_type, r.total_score ?? null, r.overall_rank, r.manual_feedback ?? null, userId]);
      return rows[0];
    });
  },
  async listWoredaRanking({ zone_id, year, period_type }) {
    const { rows } = await query(
      `SELECT wr.*, w.name AS woreda_name, w.name_amharic FROM woreda_ranking wr
       JOIN woredas w ON w.woreda_id = wr.woreda_id
       WHERE wr.year=$1 AND wr.period_type=$2 AND ($3::varchar IS NULL OR w.zone_id=$3)
       ORDER BY wr.overall_rank`, [year, period_type, zone_id ?? null]);
    return rows;
  },
  /** Raw metrics per team for the ranking engine (deadline = 5th day of the month after the period) */
  async teamMetrics({ woreda_id, period_type, year, month, quarter }) {
    const { rows } = await query(
      `WITH r AS (
         SELECT rp.id, rp.team_id, rp.status, rp.submitted_at,
                (make_date(rp.year, COALESCE(rp.month, rp.quarter * 3, 12), 1)
                  + INTERVAL '1 month' + INTERVAL '4 days') AS deadline
         FROM reports rp
         WHERE rp.woreda_id = $1 AND rp.type = $2 AND rp.year = $3
           AND ($4::int IS NULL OR rp.month = $4) AND ($5::int IS NULL OR rp.quarter = $5)
           AND rp.team_id IS NOT NULL
       ),
       q AS (
         SELECT r.team_id, AVG(tf.score / NULLIF(tf.max_score, 0) * 100) AS avg_quality
         FROM r JOIN team_feedback tf ON tf.report_id = r.id GROUP BY r.team_id
       )
       SELECT r.team_id,
              COUNT(*)::int AS total_reports,
              COUNT(*) FILTER (WHERE r.status = 'approved')::int AS approved_reports,
              COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS rejected_reports,
              AVG(CASE WHEN r.submitted_at IS NULL THEN NULL
                       ELSE GREATEST(0, EXTRACT(EPOCH FROM (r.submitted_at - r.deadline)) / 86400) END) AS avg_days_late,
              MAX(q.avg_quality) AS avg_quality
       FROM r LEFT JOIN q ON q.team_id = r.team_id
       GROUP BY r.team_id`,
      [woreda_id, period_type, year, month ?? null, quarter ?? null]);
    return rows;
  },
};
export default Ranking;
