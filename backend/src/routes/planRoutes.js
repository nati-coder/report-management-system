import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES, ZONAL_ROLES } from '../constants/roles.js';
import * as c from '../controllers/planController.js';

const router = Router();
router.use(authenticate);

router.get('/', c.listPlans);
router.get('/zone', c.getZonePlan);
router.put('/zone', authorize(ROLES.ZONAL_EXPERT), validate(schemas.zonePlanSave), audit('zone_plan.save', 'zone_plan'), c.saveZonePlan);
router.post('/cascade', authorize(ROLES.ZONAL_EXPERT), validate(schemas.plansCascade), audit('plan.cascade', 'plan'), c.cascadePlans);
router.post('/export', authorize(...ZONAL_ROLES), validate(schemas.planTableExport), c.exportPlanTable);
router.post('/monthly', authorize(ROLES.ZONAL_EXPERT), validate(schemas.monthlyPlanSave), audit('plan.monthly', 'plan'), c.saveMonthlyPlan);
router.post('/:id/review', authorize(ROLES.WOREDA_DEPT_HEAD), validate(schemas.planReview), audit('plan.review', 'plan'), c.reviewPlan);

export default router;
