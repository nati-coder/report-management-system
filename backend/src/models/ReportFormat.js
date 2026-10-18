import { query } from '../../config/db.js';

/**
 * report_formats: one row per format revision under a report_templates row,
 * holding the dynamic schema as JSONB plus a
 * draft -> pending_approval -> approved/rejected workflow.
 * (Added by migration 0001 — distinct from the legacy per-field
 * report_format_nodes tree used by Template.js.)
 *
 * Reads join the template, report version and team so callers get display
 * names (and the team/department the format applies to) in one query.
 */
const SELECT = `
  SELECT rf.*,
         t.title AS template_title, t.type AS template_type, t.active_flag AS template_active,
         t.team_id, t.department_id, t.version_id, t.start_year,
         v.name AS version_name, v.year AS version_year,
         tm.name AS team_name
  FROM report_formats rf
  JOIN report_templates t ON t.id = rf.template_id
  JOIN report_versions v ON v.id = t.version_id
  LEFT JOIN teams tm ON tm.id = t.team_id`;

const ReportFormat = {
  async list({ template_id, status, department_id, team_id, version_id } = {}) {
    const cond = []; const p = [];
    const add = (sql, v) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (template_id) add('rf.template_id = ?', template_id);
    if (status) add('rf.status = ?', status);
    if (department_id) add('t.department_id = ?', department_id);
    if (team_id) add('t.team_id = ?', team_id);
    if (version_id) add('t.version_id = ?', version_id);
    const { rows } = await query(
      `${SELECT} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY rf.created_at DESC, rf.id DESC`, p);
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`${SELECT} WHERE rf.id = $1`, [id]);
    return rows[0] || null;
  },

  /** Created by ZONAL_EXPERT or ZONAL_TEAM_LEADER. The revision number auto-increments per template. */
  async create({ template_id, schema_definition }, userId) {
    const { rows } = await query(
      `INSERT INTO report_formats (template_id, version, schema_definition, created_by)
       VALUES ($1, COALESCE((SELECT MAX(version) FROM report_formats WHERE template_id = $1), 0) + 1, $2, $3)
       RETURNING *`,
      [template_id, JSON.stringify(schema_definition), userId]);
    return rows[0];
  },

  /** Draft or rejected formats can be edited; editing a rejected one puts it back to draft for resubmission. */
  async updateSchema(id, schema_definition) {
    const { rows } = await query(
      `UPDATE report_formats SET schema_definition = $1, status = 'draft', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status IN ('draft', 'rejected') RETURNING *`,
      [JSON.stringify(schema_definition), id]);
    return rows[0] || null;
  },

  async submitForApproval(id) {
    const { rows } = await query(
      `UPDATE report_formats SET status = 'pending_approval', submitted_at = CURRENT_TIMESTAMP,
         rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [id]);
    return rows[0] || null;
  },

  /** Approved/rejected by ZONAL_DEPT_HEAD. Only a format pending approval can be decided. */
  async decide(id, { approve, reviewerId, rejection_reason }) {
    const { rows } = await query(
      `UPDATE report_formats SET
         status = $1::varchar,
         approved_by = CASE WHEN $1::varchar = 'approved' THEN $2::int ELSE approved_by END,
         approved_at = CASE WHEN $1::varchar = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
         rejection_reason = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND status = 'pending_approval' RETURNING *`,
      [approve ? 'approved' : 'rejected', reviewerId, approve ? null : (rejection_reason ?? null), id]);
    return rows[0] || null;
  },
};

export default ReportFormat;
