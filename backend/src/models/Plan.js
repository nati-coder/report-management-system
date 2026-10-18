import { query, withTransaction } from '../../config/db.js';

/**
 * plans: baseline/target values for a team + woreda + period against one
 * approved report_formats row (migration 0001). An *annual* plan has
 * month = NULL and quarter = NULL.
 *
 * A *monthly* plan is twelve rows (month = calendar month number, July = 7 … June = 6; quarter = NULL) holding the woreda's annual targets divided
 * across the year; its status is 'draft' while the expert works on it and 'submitted' once cascaded.
 *
 * Status meaning for cascaded annual plans:
 *   draft      - being prepared by the zonal expert, not visible to the woreda
 *   submitted  - cascaded down to the woreda
 *   approved   - accepted by the woreda (approved_by / approved_at)
 *   rejected   - sent back by the woreda with rejection_reason; the zonal expert may revise and cascade again
 */
const Plan = {
  async list({ format_id, team_id, department_id, woredaIds, zone_id, year, status, excludeDraft, annual, monthly } = {}) {
    const cond = []; const p = [];
    const add = (sql, v) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (format_id) add('p.format_id = ?', format_id);
    if (team_id) add('p.team_id = ?', team_id);
    if (department_id) add('t.department_id = ?', department_id);
    if (woredaIds) add('p.woreda_id = ANY(?)', woredaIds);
    if (zone_id) add('w.zone_id = ?', zone_id);
    if (year) add('p.year = ?', year);
    if (status) add('p.status = ?', status);
    if (excludeDraft) cond.push("p.status <> 'draft'");
    if (annual) cond.push('p.month IS NULL AND p.quarter IS NULL');
    if (monthly) cond.push('p.month IS NOT NULL AND p.quarter IS NULL');
    const { rows } = await query(
      `SELECT p.*, w.name AS woreda_name, w.zone_id,
              rf.version AS format_version, t.title AS template_title, t.type AS template_type, t.department_id, tm.name AS team_name
       FROM plans p
       JOIN woredas w ON w.woreda_id = p.woreda_id
       JOIN report_formats rf ON rf.id = p.format_id
       JOIN report_templates t ON t.id = rf.template_id
       LEFT JOIN teams tm ON tm.id = p.team_id
       ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY p.year DESC, w.name, p.month`, p);
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM plans WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /**
   * Cascade an annual plan to several woredas atomically. Each item becomes
   * (or updates) the woreda's plan for this format + year. A woreda whose plan
   * has already been cascaded/approved is locked: the whole call fails with
   * 409 rather than half-applying.
   */
  async cascadeMany({ format_id, team_id, year, items, status }, userId) {
    return withTransaction(async (c) => {
      const existingByWoreda = new Map();
      const locked = [];
      for (const it of items) {
        const { rows: [existing] } = await c.query(
          `SELECT * FROM plans
           WHERE format_id = $1 AND team_id = $2 AND woreda_id = $3 AND year = $4
             AND month IS NULL AND quarter IS NULL FOR UPDATE`,
          [format_id, team_id, it.woreda_id, year]);
        if (existing) {
          existingByWoreda.set(it.woreda_id, existing);
          if (!['draft', 'rejected'].includes(existing.status)) locked.push(it.woreda_id);
        }
      }
      if (locked.length) {
        throw Object.assign(
          new Error(`Plan already cascaded for woreda(s): ${locked.join(', ')}. It can no longer be changed here.`),
          { status: 409 });
      }

      const saved = [];
      for (const it of items) {
        const existing = existingByWoreda.get(it.woreda_id);
        const { rows: [row] } = existing
          ? await c.query(
            `UPDATE plans SET data = $1, status = $2::varchar, approved_by = NULL, approved_at = NULL,
               rejection_reason = CASE WHEN $2::varchar = 'submitted' THEN NULL ELSE rejection_reason END,
               updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
            [JSON.stringify(it.data), status, existing.id])
          : await c.query(
            `INSERT INTO plans (format_id, team_id, woreda_id, year, data, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [format_id, team_id, it.woreda_id, year, JSON.stringify(it.data), status, userId]);
        saved.push(row);
      }
      return saved;
    });
  },

  /**
   * Save a woreda's monthly plan: always all twelve months, atomically. Once cascaded ('submitted') it is locked,
   * and the whole call fails with 409 rather than half-applying.
   */
  async saveMonthly({ format_id, team_id, woreda_id, year, months, status }, userId) {
    return withTransaction(async (c) => {
      const { rows: existing } = await c.query(
        `SELECT * FROM plans
         WHERE format_id = $1 AND team_id = $2 AND woreda_id = $3 AND year = $4
           AND month IS NOT NULL AND quarter IS NULL FOR UPDATE`,
        [format_id, team_id, woreda_id, year]);
      if (existing.some((r) => !['draft', 'rejected'].includes(r.status))) {
        throw Object.assign(new Error('The monthly plan has already been cascaded. It can no longer be changed here.'), { status: 409 });
      }
      const byMonth = new Map(existing.map((r) => [r.month, r]));
      const saved = [];
      for (const m of months) {
        const row = byMonth.get(m.month);
        const { rows: [out] } = row
          ? await c.query(
            `UPDATE plans SET data = $1, status = $2::varchar, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
            [JSON.stringify(m.data), status, row.id])
          : await c.query(
            `INSERT INTO plans (format_id, team_id, woreda_id, year, month, data, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [format_id, team_id, woreda_id, year, m.month, JSON.stringify(m.data), status, userId]);
        saved.push(out);
      }
      return saved;
    });
  },

  /** The woreda's decision on a cascaded plan. Only a plan still waiting for it ('submitted') can be decided. */
  async decide(id, { approve, reviewerId, rejection_reason }) {
    const { rows } = await query(
      `UPDATE plans SET
         status = CASE WHEN $1::boolean THEN 'approved' ELSE 'rejected' END,
         approved_by = CASE WHEN $1::boolean THEN $2::int ELSE NULL END,
         approved_at = CASE WHEN $1::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
         rejection_reason = CASE WHEN $1::boolean THEN NULL ELSE $3::text END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND status = 'submitted' RETURNING *`,
      [approve, reviewerId ?? null, rejection_reason ?? null, id]);
    return rows[0] || null;
  },

  async setStatus(id, status, { reviewerId } = {}) {
    const { rows } = await query(
      `UPDATE plans SET status = $1::varchar,
         approved_by = CASE WHEN $1::varchar = 'approved' THEN $2::int ELSE approved_by END,
         approved_at = CASE WHEN $1::varchar = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [status, reviewerId ?? null, id]);
    return rows[0] || null;
  },
};

export default Plan;
