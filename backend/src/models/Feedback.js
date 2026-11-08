import { query } from '../../config/db.js';

/**
 * review_feedback (migration 0010): written feedback from reviewers — no scores. See the migration for the four kinds.
 * Reads join the author's name so the screen can show who wrote it.
 */
const SELECT = `
  SELECT f.*, u.name AS author_name
  FROM review_feedback f
  LEFT JOIN users u ON u.id = f.author_id`;

const Feedback = {
  async create(f, user) {
    const { rows } = await query(
      `INSERT INTO review_feedback (kind, format_id, report_id, department_id, team_id, zone_id, woreda_id, year, period, body, author_id, author_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [f.kind, f.format_id ?? null, f.report_id ?? null, f.department_id ?? null, f.team_id ?? null, f.zone_id ?? null, f.woreda_id ?? null,
        f.year ?? null, f.period ?? null, f.body.trim(), user.id, user.role]);
    const { rows: out } = await query(`${SELECT} WHERE f.id = $1`, [rows[0].id]);
    return out[0];
  },

  /** Newest first. Every given filter must match; a filter left out is not applied. */
  async list({ kind, format_id, report_id, department_id, zone_id, woreda_id, year, period } = {}) {
    const cond = ['f.kind = $1']; const p = [kind];
    const add = (col, v) => { if (v === undefined || v === null || v === '') return; p.push(v); cond.push(`f.${col} = $${p.length}`); };
    add('format_id', format_id); add('report_id', report_id); add('department_id', department_id);
    add('zone_id', zone_id); add('woreda_id', woreda_id); add('year', year); add('period', period);
    const { rows } = await query(`${SELECT} WHERE ${cond.join(' AND ')} ORDER BY f.created_at DESC, f.id DESC`, p);
    return rows;
  },
};
export default Feedback;
