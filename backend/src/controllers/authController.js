import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { success, ApiError } from '../utils/apiResponse.js';
import ActivityLog from '../models/ActivityLog.js';

const sign = (user) => jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findByEmail(email);
  // constant-ish behaviour: same error for unknown user / wrong password
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password');
  const { password_hash, ...safe } = user;
  ActivityLog.create({ user_id: user.id, action: 'auth.login', target_type: 'user', target_id: user.id, meta: { ip: req.ip } }).catch(() => {});
  success(res, { token: sign(user), user: safe }, 'Login successful');
});

export const me = catchAsync(async (req, res) => success(res, req.user));

export const changePassword = catchAsync(async (req, res) => {
  const user = await User.findWithHash(req.user.id);
  if (!(await bcrypt.compare(req.body.currentPassword, user.password_hash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  await User.updatePassword(user.id, await bcrypt.hash(req.body.newPassword, 12));
  success(res, null, 'Password updated');
});
