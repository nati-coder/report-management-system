import { query } from '../../config/db.js';

const PUBLIC = 'id, name, email, role, zone_id, woreda_id, department_id, team_id, is_active, created_at';

const User = {
  async findById(id) {
    const { rows } = await query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  },
  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return rows[0] || null;
  },
  async findWithHash(id) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async list({ role, zone_id, woreda_id, department_id, team_id, limit = 50, offset = 0 } = {}) {
    const cond = []; const p = [];
    const add = (sql, v) => { p.push(v); cond.push(sql.replace('?', `$${p.length}`)); };
    if (role) add('role = ?', role);
    if (zone_id) add('zone_id = ?', zone_id);
    if (woreda_id) add('woreda_id = ?', woreda_id);
    if (department_id) add('department_id = ?', department_id);
    if (team_id) add('team_id = ?', team_id);
    p.push(limit, offset);
    const { rows } = await query(
      `SELECT ${PUBLIC} FROM users ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY id DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
    return rows;
  },
  async create(u) {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, zone_id, woreda_id, department_id, team_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${PUBLIC}`,
      [u.name, u.email, u.password_hash, u.role, u.zone_id ?? null, u.woreda_id ?? null, u.department_id ?? null, u.team_id ?? null]
    );
    return rows[0];
  },
  async update(id, fields) {
    const allowed = ['name', 'role', 'zone_id', 'woreda_id', 'department_id', 'team_id', 'is_active'];
    const sets = []; const p = [];
    for (const k of allowed) if (k in fields) { p.push(fields[k]); sets.push(`${k} = $${p.length}`); }
    if (!sets.length) return this.findById(id);
    p.push(id);
    const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${p.length} RETURNING ${PUBLIC}`, p);
    return rows[0] || null;
  },
  async updatePassword(id, hash) {
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
  },
};
export default User;
