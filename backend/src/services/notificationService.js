import { query } from '../../config/db.js';

export async function notify(userId, message, meta = null) {
  if (!userId) return;
  await query('INSERT INTO notifications (user_id, message, meta) VALUES ($1,$2,$3)',
    [userId, message, meta ? JSON.stringify(meta) : null]);
}

export async function notifyMany(userIds, message, meta = null) {
  await Promise.all([...new Set(userIds.filter(Boolean))].map((id) => notify(id, message, meta)));
}

export async function listForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id=$1 ${unreadOnly ? 'AND is_read = false' : ''}
     ORDER BY created_at DESC LIMIT $2`, [userId, limit]);
  return rows;
}

export async function markRead(userId, id) {
  await query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND ($2::int IS NULL OR id=$2)', [userId, id ?? null]);
}
