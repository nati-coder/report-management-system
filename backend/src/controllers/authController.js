import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { success, ApiError } from '../utils/apiResponse.js';
import ActivityLog from '../models/ActivityLog.js';

// Compared against when the email is unknown, so a miss costs the same time as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const sign = (user) => jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findByEmail(email);
  // same error AND same work for unknown user / wrong password / deactivated account
  const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  const ok = Boolean(user && user.is_active && matches);
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
  // the change invalidated this session's token, so hand back a fresh one
  success(res, { token: sign(user) }, 'Password updated');
});
