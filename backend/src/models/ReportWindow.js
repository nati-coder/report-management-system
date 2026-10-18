import { query } from '../../config/db.js';

/**
 * report_windows: a monthly report format opened for the woredas of one zone for one month, between
 * opens_at and closes_at. `state` is worked out by the database clock: upcoming | open | closed.
 * The counts are for the zone: how many woredas there are and how many have submitted that month's report.
 */
const SELECT = `
  SELECT w.id, w.format_id, w.zone_id, w.year, w.month, w.opens_at, w.closes_at, w.created_by, w.created_at, w.updated_at,
         rf.version AS format_version, t.title AS template_title, t.type AS template_type,
         t.team_id, t.department_id, tm.name AS team_name, z.name AS zone_name, v.name AS version_name,
         CASE WHEN now() < w.opens_at THEN 'upcoming' WHEN now() > w.closes_at THEN 'closed' ELSE 'open' END AS state,
         (SELECT count(*) FROM woredas x WHERE x.zone_id = w.zone_id)::int AS woreda_count,
         (SELECT count(DISTINCT r.woreda_id) FROM reports r JOIN woredas x ON x.woreda_id = r.woreda_id
           WHERE x.zone_id = w.zone_id AND r.format_id = w.format_id AND r.year = w.year AND r.month = w.month
             AND r.status <> 'draft')::int AS submitted_count
  FROM report_windows w
  JOIN report_formats rf ON rf.id = w.format_id
  JOIN report_templates t ON t.id = rf.template_id
  JOIN report_versions v ON v.id = t.version_id
  LEFT JOIN teams tm ON tm.id = t.team_id
  JOIN zones z ON z.zone_id = w.zone_id`;

const ReportWindow = {
  async list({ zone_id, format_id, year, open, department_id, team_id } = {}) {
    const cond = []; const p = [];
    const add = (sql, v) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (zone_id) add('w.zone_id = ?', zone_id);
    if (format_id) add('w.format_id = ?', format_id);
    if (year) add('w.year = ?', year);
    if (department_id) add('t.department_id = ?', department_id);
    if (team_id) add('t.team_id = ?', team_id);
    if (open) cond.push('now() BETWEEN w.opens_at AND w.closes_at');
    const { rows } = await query(`${SELECT} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY w.closes_at DESC, w.id DESC`, p);
    return rows;
  },
  async findById(id) {
    const { rows } = await query(`${SELECT} WHERE w.id = $1`, [id]);
    return rows[0] || null;
  },
  async find({ format_id, zone_id, year, month }) {
    const { rows } = await query(`${SELECT} WHERE w.format_id = $1 AND w.zone_id = $2 AND w.year = $3 AND w.month = $4`, [format_id, zone_id, year, month]);
    return rows[0] || null;
  },
  async create({ format_id, zone_id, year, month, opens_at, closes_at }, userId) {
    const { rows } = await query(
      `INSERT INTO report_windows (format_id, zone_id, year, month, opens_at, closes_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [format_id, zone_id, year, month, opens_at, closes_at, userId]);
    return this.findById(rows[0].id);
  },
  async update(id, { opens_at, closes_at }) {
    await query(
      `UPDATE report_windows SET opens_at = COALESCE($1, opens_at), closes_at = COALESCE($2, closes_at), updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [opens_at ?? null, closes_at ?? null, id]);
    return this.findById(id);
  },
  async remove(id) { await query('DELETE FROM report_windows WHERE id = $1', [id]); },
  /** Every woreda of the zone with the status of its report for this window's month (none = not started). */
  async progress(w) {
    const { rows } = await query(
      `SELECT x.woreda_id, x.name, r.id AS report_id, r.status, r.submitted_at
       FROM woredas x
       LEFT JOIN LATERAL (
         SELECT id, status, submitted_at FROM reports r
         WHERE r.woreda_id = x.woreda_id AND r.format_id = $2 AND r.year = $3 AND r.month = $4
         ORDER BY r.created_at DESC LIMIT 1) r ON true
       WHERE x.zone_id = $1 ORDER BY x.name`, [w.zone_id, w.format_id, w.year, w.month]);
    return rows;
  },
};
export default ReportWindow;
