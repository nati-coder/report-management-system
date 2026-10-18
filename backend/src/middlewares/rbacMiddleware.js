import { ApiError } from '../utils/apiResponse.js';
import { ROLES, ZONAL_ROLES, WOREDA_ROLES } from '../constants/roles.js';
import { query } from '../../config/db.js';

/** Allow only listed roles. Admin always passes. */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === ROLES.ADMIN || roles.includes(req.user.role)) return next();
  next(ApiError.forbidden('You do not have permission to perform this action'));
};

/** Require the user to belong to a department (optionally a specific one) */
export const requireDepartment = (deptIdFromReq) => (req, _res, next) => {
  if (req.user.role === ROLES.ADMIN) return next();
  const wanted = deptIdFromReq ? deptIdFromReq(req) : null;
  if (!req.user.department_id) return next(ApiError.forbidden('No department assigned'));
  if (wanted && Number(wanted) !== req.user.department_id) {
    return next(ApiError.forbidden('Resource belongs to another department'));
  }
  next();
};

/**
 * Data-scope helper: can `user` access data of `woredaId`?
 * - admin: everything; zonal roles: woredas in their zone; woreda roles: their own woreda
 */
export async function canAccessWoreda(user, woredaId) {
  if (user.role === ROLES.ADMIN) return true;
  if (WOREDA_ROLES.includes(user.role)) return user.woreda_id === woredaId;
  if (ZONAL_ROLES.includes(user.role)) {
    const { rows } = await query('SELECT 1 FROM woredas WHERE woreda_id = $1 AND zone_id = $2', [
      woredaId,
      user.zone_id,
    ]);
    return rows.length > 0;
  }
  return false;
}

export const enforceWoredaScope = (getWoredaId) => async (req, _res, next) => {
  try {
    const woredaId = getWoredaId(req);
    if (!woredaId) return next();
    if (await canAccessWoreda(req.user, woredaId)) return next();
    next(ApiError.forbidden('Outside your administrative scope'));
  } catch (e) {
    next(e);
  }
};
