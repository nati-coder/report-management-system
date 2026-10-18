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
  async list({ woreda_id, limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT * FROM import_logs WHERE ($1::varchar IS NULL OR woreda_id=$1) ORDER BY imported_at DESC LIMIT $2 OFFSET $3`,
      [woreda_id ?? null, limit, offset]);
    return rows;
  },
};
export default ImportLog;
