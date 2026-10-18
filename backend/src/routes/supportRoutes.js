import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/supportController.js';

const router = Router();
router.use(authenticate);

router.get('/', c.listRequests);
router.get('/experts/:expertId/rating', authorize(ROLES.ZONAL_DEPT_HEAD), c.expertRating);
router.get('/:id', c.getRequest);
router.post('/', authorize(ROLES.WOREDA_DEPT_HEAD), validate(schemas.supportRequest), audit('support.create', 'support_request'), c.createRequest);
router.patch('/:id/assign', authorize(ROLES.ZONAL_DEPT_HEAD), validate(schemas.assignSupport), audit('support.assign', 'support_request'), c.assignExpert);
router.patch('/:id/status', authorize(ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT), validate(schemas.supportStatus), audit('support.status', 'support_request'), c.updateStatus);
router.post('/:id/feedback', authorize(ROLES.WOREDA_DEPT_HEAD), validate(schemas.expertFeedback), audit('support.feedback', 'support_request'), c.giveFeedback);

export default router;
