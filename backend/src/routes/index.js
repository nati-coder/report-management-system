import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import templateRoutes from './templateRoutes.js';
import reportRoutes from './reportRoutes.js';
import rankingRoutes from './rankingRoutes.js';
import supportRoutes from './supportRoutes.js';
import importRoutes from './importRoutes.js';
import referenceRoutes from './referenceRoutes.js';
import reportFormatRoutes from './reportFormatRoutes.js';
import planRoutes from './planRoutes.js';
import reportWindowRoutes from './reportWindowRoutes.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/templates', templateRoutes);
router.use('/reports', reportRoutes);
router.use('/rankings', rankingRoutes);
router.use('/support-requests', supportRoutes);
router.use('/imports', importRoutes);
router.use('/reference', referenceRoutes);
router.use('/report-formats', reportFormatRoutes);
router.use('/plans', planRoutes);
router.use('/report-windows', reportWindowRoutes);

export default router;
