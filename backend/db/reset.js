import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));

/**
 * Wipes ALL data so you can test from scratch. The tables, columns and migrations stay exactly as they are
 * (schema_migrations is not touched), so you do NOT need to run `npm run migrate` again.
 *
 *   npm run db:reset           empty every table (you then have no users — run the seed, or use db:reset:seed)
 *   npm run db:reset:seed      empty every table, then create the starter data again (see db/seed.js)
 *
 * Options:  --seed  run db/seed.js afterwards   --uploads  also delete the uploaded Excel files
 *           --yes   don't ask for confirmation   --force  allow it when NODE_ENV=production
 */
async function main() {
  if (env.isProd && !args.has('--force')) {
    console.error('[reset] NODE_ENV is production — refusing to wipe the database. Use --force if you really mean it.');
    process.exit(1);
  }

  const db = new URL(env.DATABASE_URL).pathname.replace(/^\//, '');
  if (!args.has('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`This deletes ALL data in database "${db}". Type the database name to continue: `);
    rl.close();
    if (answer.trim() !== db) { console.log('[reset] cancelled — nothing was deleted.'); await pool.end(); return; }
  }

  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename`);
  if (!rows.length) { console.log('[reset] no tables found — run `npm run migrate` first.'); await pool.end(); return; }

  const list = rows.map((r) => `public."${r.tablename}"`).join(', ');
  await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`[reset] emptied ${rows.length} tables; ids start from 1 again.`);

  if (args.has('--uploads') && fs.existsSync(env.UPLOAD_DIR)) {
    for (const f of fs.readdirSync(env.UPLOAD_DIR)) fs.rmSync(path.join(env.UPLOAD_DIR, f), { recursive: true, force: true });
    console.log(`[reset] cleared ${env.UPLOAD_DIR}`);
  }

  await pool.end();

  if (args.has('--seed')) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  } else {
    console.log('[reset] done. The database is empty — run `npm run seed` to create the admin account.');
  }
}

main().catch(async (err) => {
  console.error('[reset] failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
