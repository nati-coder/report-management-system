import { query } from '../../config/db.js';

/** The zone's annual targets for one approved report format (see migration 0003). */
const ZonePlan = {
  async find({ format_id, zone_id, year }) {
    const { rows } = await query('SELECT * FROM zone_plans WHERE format_id = $1 AND zone_id = $2 AND year = $3', [format_id, zone_id, year]);
    return rows[0] || null;
  },
  async listFor({ zone_id, year }) {
    const { rows } = await query('SELECT * FROM zone_plans WHERE zone_id = $1 AND year = $2', [zone_id, year]);
    return rows;
  },
  async upsert({ format_id, zone_id, team_id, year, data }, userId) {
    const { rows } = await query(
      `INSERT INTO zone_plans (format_id, zone_id, team_id, year, data, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (format_id, zone_id, year) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [format_id, zone_id, team_id, year, JSON.stringify(data), userId]);
    return rows[0];
  },
};
export default ZonePlan;
