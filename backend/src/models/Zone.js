import { query } from '../../config/db.js';

const Zone = {
  async listZones() {
    const { rows } = await query('SELECT * FROM zones ORDER BY name');
    return rows;
  },
  async listWoredas(zoneId) {
    const { rows } = zoneId
      ? await query('SELECT * FROM woredas WHERE zone_id = $1 ORDER BY name', [zoneId])
      : await query('SELECT * FROM woredas ORDER BY name');
    return rows;
  },
  async findWoreda(woredaId) {
    const { rows } = await query('SELECT * FROM woredas WHERE woreda_id = $1', [woredaId]);
    return rows[0] || null;
  },
  async findZone(zoneId) {
    const { rows } = await query('SELECT * FROM zones WHERE zone_id = $1', [zoneId]);
    return rows[0] || null;
  },
  async createZone({ zone_id, name, name_amharic }) {
    const { rows } = await query(
      'INSERT INTO zones (zone_id, name, name_amharic) VALUES ($1,$2,$3) RETURNING *',
      [zone_id, name, name_amharic ?? null]);
    return rows[0];
  },
  async createWoreda({ woreda_id, zone_id, name, name_amharic }) {
    const { rows } = await query(
      'INSERT INTO woredas (woreda_id, zone_id, name, name_amharic) VALUES ($1,$2,$3,$4) RETURNING *',
      [woreda_id, zone_id, name, name_amharic ?? null]);
    return rows[0];
  },
  async updateZone(zoneId, { name, name_amharic }) {
    const { rows } = await query(
      'UPDATE zones SET name = COALESCE($1, name), name_amharic = COALESCE($2, name_amharic) WHERE zone_id = $3 RETURNING *',
      [name ?? null, name_amharic ?? null, zoneId]);
    return rows[0] || null;
  },
  async deleteZone(zoneId) {
    await query('DELETE FROM zones WHERE zone_id = $1', [zoneId]);
  },
  async updateWoreda(woredaId, { name, name_amharic, zone_id }) {
    const { rows } = await query(
      `UPDATE woredas SET name = COALESCE($1, name), name_amharic = COALESCE($2, name_amharic), zone_id = COALESCE($3, zone_id)
       WHERE woreda_id = $4 RETURNING *`,
      [name ?? null, name_amharic ?? null, zone_id ?? null, woredaId]);
    return rows[0] || null;
  },
  async deleteWoreda(woredaId) {
    await query('DELETE FROM woredas WHERE woreda_id = $1', [woredaId]);
  },
};
export default Zone;
