import { query } from '../../config/db.js';

const Department = {
  async list() {
    const { rows } = await query('SELECT * FROM departments ORDER BY name');
    return rows;
  },
  async listTeams(departmentId) {
    const { rows } = departmentId
      ? await query('SELECT * FROM teams WHERE department_id = $1 ORDER BY name', [departmentId])
      : await query('SELECT * FROM teams ORDER BY name');
    return rows;
  },
  async findTeam(id) {
    const { rows } = await query('SELECT * FROM teams WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async findById(id) {
    const { rows } = await query('SELECT * FROM departments WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async createDepartment({ name, amharic_name }) {
    const { rows } = await query(
      'INSERT INTO departments (name, amharic_name) VALUES ($1,$2) RETURNING *', [name, amharic_name]);
    return rows[0];
  },
  async createTeam({ name, department_id }) {
    const { rows } = await query(
      'INSERT INTO teams (name, department_id) VALUES ($1,$2) RETURNING *', [name, department_id]);
    return rows[0];
  },
  async updateDepartment(id, { name, amharic_name }) {
    const { rows } = await query(
      'UPDATE departments SET name = COALESCE($1, name), amharic_name = COALESCE($2, amharic_name) WHERE id = $3 RETURNING *',
      [name ?? null, amharic_name ?? null, id]);
    return rows[0] || null;
  },
  async deleteDepartment(id) {
    await query('DELETE FROM departments WHERE id = $1', [id]);
  },
  async updateTeam(id, { name, department_id }) {
    const { rows } = await query(
      'UPDATE teams SET name = COALESCE($1, name), department_id = COALESCE($2, department_id) WHERE id = $3 RETURNING *',
      [name ?? null, department_id ?? null, id]);
    return rows[0] || null;
  },
  async deleteTeam(id) {
    await query('DELETE FROM teams WHERE id = $1', [id]);
  },
  /** Guards against silently cascading away a template's node definitions when a team is deleted. */
  async countReportFormats(teamId) {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM report_formats WHERE team_id = $1', [teamId]);
    return rows[0].n;
  },
};
export default Department;
