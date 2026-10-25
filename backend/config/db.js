import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

// Return numeric/decimal as JS numbers instead of strings
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// Keep "timestamp without time zone" as ISO-ish strings
pg.types.setTypeParser(1114, (v) => v);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('Unexpected PG pool error', err));

/** Parameterized query helper. Always pass values via `params`. */
export const query = (text, params = []) => pool.query(text, params);

/** Run callback inside a transaction. Callback receives a client. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` while holding a Postgres advisory lock named `name`, so that two requests doing the same
 * read-check-write sequence (e.g. adding up woreda targets against the zone plan) take turns instead of
 * both passing the check. The lock is held on its own connection; `fn` may use `query` / `withTransaction`.
 * Always released, even when `fn` throws.
 */
export async function withAdvisoryLock(name, fn) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [name]);
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [name]);
    }
  } finally {
    client.release();
  }
}

export default pool;
