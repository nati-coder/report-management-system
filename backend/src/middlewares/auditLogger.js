import ActivityLog from '../models/ActivityLog.js';

/**
 * Audit middleware for data-modifying routes.
 * Usage: router.post('/', audit('report.create', 'report'), handler)
 * Logs after a successful (<400) response. Target id is taken from res.locals.auditTargetId or req.params.id.
 */
export const audit = (action, targetType) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const targetId = res.locals.auditTargetId ?? (req.params.id ? Number(req.params.id) : null);
    const { password, currentPassword, newPassword, ...safeBody } = req.body || {};
    ActivityLog.create({
      user_id: req.user.id,
      action,
      target_type: targetType,
      target_id: Number.isInteger(targetId) ? targetId : null,
      meta: { method: req.method, path: req.originalUrl, ip: req.ip, body: safeBody },
    }).catch((e) => console.error('Audit log failed', e.message));
  });
  next();
};

/** Global fallback: audit every mutating request that has no explicit audit() */
export const auditMutations = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return audit(`${req.method} ${req.baseUrl}${req.route?.path || ''}`, 'http')(req, res, next);
};
