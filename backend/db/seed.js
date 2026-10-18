import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { ROLES } from '../src/constants/roles.js';

/**
 * Seeds a minimal starting dataset: one zone, one woreda, one
 * department/team, and a default admin account so you can log in
 * on a fresh database. Safe to re-run (uses ON CONFLICT DO NOTHING).
 */
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO zones (zone_id, name, name_amharic) VALUES ($1,$2,$3) ON CONFLICT (zone_id) DO NOTHING`,
      ['Z01', 'Jimma Zone', 'ጅማ ዞን']
    );
    await client.query(
      `INSERT INTO woredas (woreda_id, zone_id, name, name_amharic) VALUES ($1,$2,$3,$4) ON CONFLICT (woreda_id) DO NOTHING`,
      ['W01', 'Z01', 'Jimma Woreda', 'ጅማ ወረዳ']
    );

    const dept = await client.query(
      `INSERT INTO departments (name, amharic_name) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING id`,
      ['Planning Department', 'እቅድ ክፍል']
    );
    const departmentId = dept.rows[0]?.id;

    if (departmentId) {
      await client.query(
        `INSERT INTO teams (name, department_id) VALUES ($1,$2)`,
        ['Core Planning Team', departmentId]
      );
    }

    const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      ['System Admin', 'admin@rms.local', passwordHash, ROLES.ADMIN]
    );

    await client.query('COMMIT');
    console.log('[seed] done. Default admin: admin@rms.local / ChangeMe123! (change immediately)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
