import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import Department from '../models/Department.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES } from '../constants/roles.js';

/** Business rules: woreda roles need woreda_id, zonal roles need zone_id */
function checkPlacement(u) {
  if (WOREDA_ROLES.includes(u.role) && !u.woreda_id) throw ApiError.badRequest('woreda_id is required for woreda-level roles');
  if (ZONAL_ROLES.includes(u.role) && !u.zone_id) throw ApiError.badRequest('zone_id is required for zonal-level roles');
}

export const createUser = catchAsync(async (req, res) => {
  checkPlacement(req.body);
  if (req.body.woreda_id && !req.body.zone_id) {
    const w = await Zone.findWoreda(req.body.woreda_id);
    if (!w) throw ApiError.badRequest('Unknown woreda_id');
    req.body.zone_id = w.zone_id;
  }
  const password_hash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({ ...req.body, password_hash });
  res.locals.auditTargetId = user.id;
  created(res, user, 'User created');
});

export const listUsers = catchAsync(async (req, res) => {
  const { role, zone_id, woreda_id, department_id, limit, offset } = req.query;
  const filters = { role, zone_id, woreda_id, department_id, limit: Number(limit) || 50, offset: Number(offset) || 0 };
  // zonal heads may only list their own zone
  if (req.user.role !== ROLES.ADMIN) filters.zone_id = req.user.zone_id;
  success(res, await User.list(filters));
});

export const getUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  success(res, user);
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await User.update(req.params.id, req.body);
  if (!user) throw ApiError.notFound('User not found');
  success(res, user, 'User updated');
});

/** Admin sets a specific new password for the user (validated as a strong password by the route). */
export const resetPassword = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  await User.updatePassword(user.id, await bcrypt.hash(req.body.newPassword, 12));
  success(res, null, 'Password updated');
});

export const referenceData = catchAsync(async (_req, res) => {
  const [zones, woredas, departments, teams] = await Promise.all([
    Zone.listZones(), Zone.listWoredas(), Department.list(), Department.listTeams(),
  ]);
  success(res, { zones, woredas, departments, teams });
});
