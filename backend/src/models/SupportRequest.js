import { query } from '../../config/db.js';

const SupportRequest = {
  async list({ woreda_department_head_id, zone_id, assigned_expert_id, status, limit = 50, offset = 0 } = {}) {
    const cond = []; const p = [];
    const add = (sql, v) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (woreda_department_head_id) add('sr.woreda_department_head_id = ?', woreda_department_head_id);
    if (zone_id) add('sr.zone_id = ?', zone_id);
    if (assigned_expert_id) add('sr.assigned_expert_id = ?', assigned_expert_id);
    if (status) add('sr.status = ?', status);
    p.push(limit, offset);
    const { rows } = await query(
      `SELECT sr.*, u.name AS requester_name, e.name AS expert_name
       FROM support_requests sr
       LEFT JOIN users u ON u.id = sr.woreda_department_head_id
       LEFT JOIN users e ON e.id = sr.assigned_expert_id
       ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY sr.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
    return rows;
  },
  async findById(id) {
    const { rows } = await query('SELECT * FROM support_requests WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async create(s, user, zoneId, zonalHeadId) {
    const { rows } = await query(
      `INSERT INTO support_requests (title, description, category, priority, woreda_department_head_id, zone_id, zonal_department_head_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [s.title, s.description, s.category ?? null, s.priority ?? 'medium', user.id, zoneId, zonalHeadId ?? null]);
    return rows[0];
  },
  async assign(id, expertId) {
    const { rows } = await query(
      `UPDATE support_requests SET assigned_expert_id=$1, status='assigned', updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,
      [expertId, id]);
    return rows[0] || null;
  },
  async setStatus(id, status) {
    const { rows } = await query(
      'UPDATE support_requests SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [status, id]);
    return rows[0] || null;
  },
  async addFeedback(f) {
    const { rows } = await query(
      `INSERT INTO expert_feedback (support_request_id, expert_id, given_by, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [f.support_request_id, f.expert_id, f.given_by, f.rating, f.comment ?? null]);
    return rows[0];
  },
  async feedbackExists(supportRequestId) {
    const { rows } = await query('SELECT 1 FROM expert_feedback WHERE support_request_id=$1', [supportRequestId]);
    return rows.length > 0;
  },
  async expertRatings(expertId) {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS count, ROUND(AVG(rating),2) AS average FROM expert_feedback WHERE expert_id=$1', [expertId]);
    return rows[0];
  },
};
export default SupportRequest;
