import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { uploadExcel } from '../middlewares/uploadMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/importController.js';

const router = Router();
router.use(authenticate, authorize(ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT));

router.get('/', c.listImports);
router.post('/', uploadExcel, audit('import.excel', 'import_log'), c.importExcel);

export default router;
