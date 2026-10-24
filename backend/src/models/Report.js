import { query } from '../../config/db.js';

const Report = {
  async list({ woredaIds, zone_id, status, excludeDraft, type, year, team_id, created_by, limit = 50, offset = 0 } = {}) {
    const cond = []; const p = [];
    const add = (sql, v) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (woredaIds) add('r.woreda_id = ANY(?)', woredaIds);
    if (zone_id) add('w.zone_id = ?', zone_id);
    if (status) add('r.status = ?', status);
    if (type) add('r.type = ?', type);
    if (year) add('r.year = ?', year);
    if (team_id) add('r.team_id = ?', team_id);
    if (created_by) add('r.created_by = ?', created_by);
    if (excludeDraft) cond.push("r.status NOT IN ('draft','pending_woreda','woreda_approved')"); // zone users: only what the woreda has submitted
    p.push(limit, offset);
    const { rows } = await query(
      `SELECT r.id, r.format_id, r.title, r.type, r.year, r.quarter, r.month, r.woreda_id, r.team_id,
              r.status, r.source, r.submitted_at, r.created_at, r.updated_at, w.name AS woreda_name, tm.name AS team_name
       FROM reports r LEFT JOIN woredas w ON w.woreda_id = r.woreda_id
       LEFT JOIN teams tm ON tm.id = r.team_id
       ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY r.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
    return rows;
  },
  /**
   * The reports of one format and period, with their values — the rows behind the all-woredas sheet.
   * Drafts are the woreda's own working copy and never included. When a woreda has filed the same period twice,
   * the latest one wins.
   */
  async sheet({ format_id, year, type, month, quarter, woredaIds }) {
    const p = [format_id, year, woredaIds];
    let period = '';
    if (type === 'monthly') { p.push(month); period = `AND r.month = $${p.length}`; }
    else if (type === 'quarterly') { p.push(quarter); period = `AND r.quarter = $${p.length}`; }
    else period = 'AND r.month IS NULL AND r.quarter IS NULL';
    const { rows } = await query(
      `SELECT r.id, r.woreda_id, r.status, r.data, r.submitted_at, r.created_at
       FROM reports r
       WHERE r.format_id = $1 AND r.year = $2 AND r.woreda_id = ANY($3) AND r.status NOT IN ('draft','pending_woreda','woreda_approved') ${period}
       ORDER BY r.created_at DESC`, p);
    const latest = new Map();
    for (const r of rows) if (!latest.has(r.woreda_id)) latest.set(r.woreda_id, r);
    return [...latest.values()];
  },
  /** Reports of one format / year / month — of one woreda, or of every woreda of a zone. */
  async findPeriod({ format_id, year, month, woreda_id, zone_id }) {
    const p = [format_id, year, month];
    let who = '';
    if (woreda_id) { p.push(woreda_id); who = `AND r.woreda_id = $${p.length}`; }
    if (zone_id) { p.push(zone_id); who += ` AND w.zone_id = $${p.length}`; }
    const { rows } = await query(
      `SELECT r.id, r.woreda_id, r.status FROM reports r LEFT JOIN woredas w ON w.woreda_id = r.woreda_id
       WHERE r.format_id = $1 AND r.year = $2 AND r.month = $3 ${who}`, p);
    return rows;
  },
  /** Submitted reports (never drafts) of a monthly format over several months — the latest per woreda and month. */
  async sheetMonths({ format_id, year, months, woredaIds }) {
    const { rows } = await query(
      `SELECT r.id, r.woreda_id, r.month, r.status, r.data, r.created_at FROM reports r
       WHERE r.format_id = $1 AND r.year = $2 AND r.month = ANY($3) AND r.woreda_id = ANY($4) AND r.status NOT IN ('draft','pending_woreda','woreda_approved')
       ORDER BY r.created_at DESC`, [format_id, year, months, woredaIds]);
    const latest = new Map();
    for (const r of rows) { const k = `${r.woreda_id}|${r.month}`; if (!latest.has(k)) latest.set(k, r); }
    return [...latest.values()];
  },
  async findById(id) {
    const { rows } = await query(
      `SELECT r.*, w.name AS woreda_name, w.zone_id FROM reports r
       LEFT JOIN woredas w ON w.woreda_id = r.woreda_id WHERE r.id = $1`, [id]);
    return rows[0] || null;
  },
  /** r.format_id must reference an APPROVED report_formats row (enforced at the controller level). */
  async create(r, userId) {
    const { rows } = await query(
      `INSERT INTO reports (format_id, title, type, year, quarter, month, woreda_id, team_id, created_by, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [r.format_id, r.title, r.type, r.year, r.quarter ?? null, r.month ?? null, r.woreda_id, r.team_id ?? null, userId, JSON.stringify(r.data ?? {})]);
    return rows[0];
  },
  async updateData(id, { title, data }) {
    const { rows } = await query(
      `UPDATE reports SET title = COALESCE($1, title), data = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [title ?? null, JSON.stringify(data), id]);
    return rows[0] || null;
  },
  async setStatus(id, status, { reviewerId, feedback } = {}) {
    const { rows } = await query(
      `UPDATE reports SET status = $1::varchar,
         submitted_at = CASE WHEN $1::varchar IN ('submitted','pending_woreda') THEN CURRENT_TIMESTAMP ELSE submitted_at END,
         reviewed_by = COALESCE($2::int, reviewed_by),
         feedback = COALESCE($3, feedback),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, reviewerId ?? null, feedback ?? null, id]);
    return rows[0] || null;
  },
  async remove(id) {
    await query('DELETE FROM reports WHERE id = $1', [id]);
  },
  /** The woreda plan expert's decision: approve (status woreda_approved) or send back (rejected, with feedback). */
  async setWoredaStatus(id, status, { userId, feedback } = {}) {
    const approved = status === 'woreda_approved';
    const { rows } = await query(
      `UPDATE reports SET status = $1::varchar,
         woreda_approved_by = CASE WHEN $5::boolean THEN $2::int ELSE NULL END,
         woreda_approved_at = CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
         feedback = COALESCE($3, feedback), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`, [status, userId ?? null, feedback ?? null, id, approved]);
    return rows[0] || null;
  },
  /** The woreda has submitted: its approved team reports go to the zone together. */
  async forward(ids) {
    await query(`UPDATE reports SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ANY($1) AND status = 'woreda_approved'`, [ids]);
  },
  /** The latest report of each (format, woreda) of a zone for one month — what a reporting period is built from. */
  async forPeriod({ format_ids, year, month, zone_id }) {
    const { rows } = await query(
      `SELECT DISTINCT ON (r.format_id, r.woreda_id) r.id, r.format_id, r.woreda_id, r.status, r.submitted_at
       FROM reports r JOIN woredas w ON w.woreda_id = r.woreda_id
       WHERE r.format_id = ANY($1) AND r.year = $2 AND r.month = $3 AND w.zone_id = $4
       ORDER BY r.format_id, r.woreda_id, r.created_at DESC`, [format_ids, year, month, zone_id]);
    return rows;
  },

  // ---- LEGACY annual plan values (used by the existing Excel-import
  // pipeline against report_format_nodes, the old per-field tree renamed
  // by migration 0001). New plan data should use the Plan model instead,
  // which stores a JSONB blob per period against an approved
  // report_formats row rather than one row per field. ----
  async findOrCreatePlan(client, { woreda_id, team_id, report_version_id, zone_expert_id }) {
    const { rows } = await client.query(
      `INSERT INTO annual_plans (woreda_id, team_id, report_version_id, zone_expert_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (woreda_id, team_id, report_version_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`, [woreda_id, team_id, report_version_id, zone_expert_id]);
    return rows[0];
  },
  async upsertPlanValue(client, planId, nodeId, v) {
    const { rows } = await client.query(
      `INSERT INTO plan_values (plan_id, node_id, text_value, numeric_value, date_value, boolean_value, remarks, data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (plan_id, node_id) DO UPDATE SET
         text_value = EXCLUDED.text_value, numeric_value = EXCLUDED.numeric_value,
         date_value = EXCLUDED.date_value, boolean_value = EXCLUDED.boolean_value,
         remarks = EXCLUDED.remarks, data_source = EXCLUDED.data_source, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [planId, nodeId, v.text ?? null, v.numeric ?? null, v.date ?? null, v.boolean ?? null, v.remarks ?? null, v.data_source ?? 'excel_import']);
    return rows[0].id;
  },
  async upsertMonthlyValue(client, planValueId, nodeId, month, year, v) {
    await client.query(
      `INSERT INTO plan_monthly_values (plan_value_id, node_id, month, year, text_value, numeric_value, percentage)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (plan_value_id, node_id, month, year) DO UPDATE SET
         text_value = EXCLUDED.text_value, numeric_value = EXCLUDED.numeric_value,
         percentage = EXCLUDED.percentage, updated_at = CURRENT_TIMESTAMP`,
      [planValueId, nodeId, month, year, v.text ?? null, v.numeric ?? null, v.percentage ?? null]);
  },
  async getPlanWithValues(planId) {
    const { rows: [plan] } = await query('SELECT * FROM annual_plans WHERE id = $1', [planId]);
    if (!plan) return null;
    const { rows: values } = await query(
      `SELECT pv.*, rf.node_code, rf.label FROM plan_values pv
       JOIN report_format_nodes rf ON rf.id = pv.node_id WHERE pv.plan_id = $1 ORDER BY rf.level, rf.display_order`, [planId]);
    return { ...plan, values };
  },
};
export default Report;
