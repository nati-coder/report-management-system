import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/reportWindowController.js';

const router = Router();
router.use(authenticate);

// Reading is scoped inside the controller (zone, department, team); opening and changing periods is the zone's.
const opener = authorize(ROLES.ZONAL_PLAN_EXPERT); // the Zonal Plan Expert opens, changes and removes periods (admin always passes)
router.get('/', c.listWindows);
router.get('/:id', authorize(ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_PLAN_EXPERT), c.getWindow);
router.post('/', opener, validate(schemas.reportWindow), audit('report_window.create', 'report_window'), c.createWindow);
router.put('/:id', opener, validate(schemas.reportWindowUpdate), audit('report_window.update', 'report_window'), c.updateWindow);
router.delete('/:id', opener, audit('report_window.delete', 'report_window'), c.deleteWindow);

export default router;
