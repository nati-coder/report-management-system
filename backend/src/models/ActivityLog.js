import { query } from '../../config/db.js';

const ActivityLog = {
  async create({ user_id, action, target_type, target_id, meta }) {
    await query(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, meta) VALUES ($1,$2,$3,$4,$5)',
      [user_id ?? null, action, target_type ?? null, target_id ?? null, meta ? JSON.stringify(meta) : null]);
  },
  async list({ user_id, limit = 100, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT al.*, u.name AS user_name FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id
       WHERE ($1::int IS NULL OR al.user_id = $1) ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
      [user_id ?? null, limit, offset]);
    return rows;
  },
};
export default ActivityLog;
