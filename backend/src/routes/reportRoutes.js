import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES, REVIEWER_ROLES } from '../constants/roles.js';
import * as c from '../controllers/reportController.js';

const router = Router();
router.use(authenticate);

router.get('/', c.listReports);
router.get('/sheet', authorize(...ZONAL_ROLES), c.reportSheet); // before /:id
router.get('/plans/:id', c.getPlan);
router.get('/:id', c.getReport);
router.post('/', authorize(...WOREDA_ROLES), validate(schemas.report), audit('report.create', 'report'), c.createReport);
router.put('/:id', authorize(...WOREDA_ROLES), validate(schemas.reportUpdate), audit('report.update', 'report'), c.updateReport);
router.post('/:id/submit', authorize(...WOREDA_ROLES), audit('report.submit', 'report'), c.submitReport);
router.post('/:id/woreda-review', authorize(ROLES.WOREDA_PLAN_EXPERT), validate(schemas.woredaReview), audit('report.woreda_review', 'report'), c.woredaReview);
router.post('/:id/review', authorize(...REVIEWER_ROLES), validate(schemas.review), audit('report.review', 'report'), c.reviewReport);
router.delete('/:id', authorize(...WOREDA_ROLES), audit('report.delete', 'report'), c.deleteReport);

export default router;
