import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, me, changePassword } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../utils/validators.js';
import { audit } from '../middlewares/auditLogger.js';
import catchAsync from '../utils/catchAsync.js';
import { success } from '../utils/apiResponse.js';
import { listForUser, markRead } from '../services/notificationService.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again later' } });

router.post('/login', loginLimiter, validate(schemas.login), login);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, validate(schemas.changePassword), audit('auth.change_password', 'user'), changePassword);

router.get('/notifications', authenticate, catchAsync(async (req, res) =>
  success(res, await listForUser(req.user.id, { unreadOnly: req.query.unread === 'true' }))));
router.post('/notifications/read', authenticate, catchAsync(async (req, res) => {
  await markRead(req.user.id, req.body?.id); success(res, null, 'Marked as read');
}));

export default router;
