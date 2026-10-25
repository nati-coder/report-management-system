import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import Department from '../models/Department.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES } from '../constants/roles.js';
import { checkPlacement, withTeamRule } from '../utils/userRules.js';

/** The team must exist and sit in the user's department (when one is given). */
async function checkTeam(u) {
  if (!u.team_id) return;
  const team = await Department.findTeam(u.team_id);
  if (!team) throw ApiError.badRequest('Unknown team_id');
  if (u.department_id && team.department_id !== Number(u.department_id)) throw ApiError.badRequest('The team does not belong to the selected department');
}

export const createUser = catchAsync(async (req, res) => {
  req.body = withTeamRule(req.body); // department heads and plan experts have no team, whatever the client sent
  checkPlacement(req.body);
  await checkTeam(req.body);
  if (req.body.woreda_id) { // a woreda user's zone is always the woreda's zone, whatever the client sent
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
  // a zonal head may only see their own zone's people (404, not 403, so ids of other zones are not confirmed)
  if (!user || (req.user.role !== ROLES.ADMIN && user.zone_id !== req.user.zone_id)) throw ApiError.notFound('User not found');
  success(res, user);
});

export const updateUser = catchAsync(async (req, res) => {
  // Changing role / woreda / team re-checks the rules on the resulting user (a plain edit like deactivating doesn't).
  if (['role', 'woreda_id', 'team_id', 'department_id'].some((k) => k in req.body)) {
    const current = await User.findById(req.params.id);
    if (!current) throw ApiError.notFound('User not found');
    const merged = withTeamRule({ ...current, ...req.body });
    checkPlacement(merged);
    await checkTeam(merged);
    if (merged.team_id === null && (current.team_id !== null || req.body.team_id)) req.body.team_id = null; // team-less role: never keep or set a team
  }
  if (req.body.woreda_id) { // moving a user to another woreda moves their zone with it
    const w = await Zone.findWoreda(req.body.woreda_id);
    if (!w) throw ApiError.badRequest('Unknown woreda_id');
    req.body.zone_id = w.zone_id;
  }
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
