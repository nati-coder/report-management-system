import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/reportFormatController.js';

const router = Router();
router.use(authenticate);

// Per the role rules: formats are authored by Zonal Expert / Zonal Team Leader
// and approved by the Zonal Dept Head (Admin always passes authorize()).
const formatEditors = authorize(ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER);
const formatApprovers = authorize(ROLES.ZONAL_DEPT_HEAD);

router.get('/', c.listFormats); // everyone signed in can read; woreda users need approved formats to file reports
router.get('/:id/export', c.exportFormat); // ?type=xlsx|csv — approved formats only
router.get('/:id', c.getFormat);
router.post('/', formatEditors, validate(schemas.reportFormat), audit('report_format.create', 'report_format'), c.createFormat);
router.put('/:id', formatEditors, validate(schemas.reportFormatUpdate), audit('report_format.update', 'report_format'), c.updateFormat);
router.post('/:id/submit', formatEditors, audit('report_format.submit', 'report_format'), c.submitFormat);
router.post('/:id/review', formatApprovers, validate(schemas.reportFormatReview), audit('report_format.review', 'report_format'), c.reviewFormat);

export default router;
