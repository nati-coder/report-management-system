import { query } from '../../config/db.js';

const ImportLog = {
  async create({ admin_id, woreda_id, file_name, file_path }) {
    const { rows } = await query(
      `INSERT INTO import_logs (admin_id, woreda_id, file_name, file_path) VALUES ($1,$2,$3,$4) RETURNING *`,
      [admin_id, woreda_id, file_name, file_path]);
    return rows[0];
  },
  async finish(id, status, remarks) {
    const { rows } = await query('UPDATE import_logs SET status=$1, remarks=$2 WHERE id=$3 RETURNING *', [status, remarks ?? null, id]);
    return rows[0];
  },
  /** `zone_id` limits the log to one zone's woredas (always set for non-admins). */
  async list({ woreda_id, zone_id, limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT il.* FROM import_logs il JOIN woredas w ON w.woreda_id = il.woreda_id
       WHERE ($1::varchar IS NULL OR il.woreda_id = $1) AND ($2::varchar IS NULL OR w.zone_id = $2)
       ORDER BY il.imported_at DESC LIMIT $3 OFFSET $4`,
      [woreda_id ?? null, zone_id ?? null, limit, offset]);
    return rows;
  },
};
export default ImportLog;
