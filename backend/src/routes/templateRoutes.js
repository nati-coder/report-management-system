import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/templateController.js';

const router = Router();
router.use(authenticate);
// Report versions are managed by Admin / Zonal Dept Head. The Zonal Plan Expert
// only picks an existing version when creating a template — they don't create versions.
const versionEditors = authorize(ROLES.ZONAL_DEPT_HEAD);
// Per spec: team-specific report templates are the Zonal Plan Expert's
// responsibility specifically (not shared with Zonal Dept Head, who only
// approves report_versions, not templates).
const templateEditors = authorize(ROLES.ZONAL_PLAN_EXPERT);

// report_version / report_formats (declared before "/:id")
router.get('/versions', c.listVersions);
router.post('/versions', versionEditors, validate(schemas.reportVersion), audit('report_version.create', 'report_version'), c.createVersion);
router.get('/versions/:id', c.getVersion);
// Closing is the System Admin's alone (authorize() with no roles lets only the admin through).
router.post('/versions/:id/close', authorize(), audit('report_version.close', 'report_version'), c.closeVersion);
router.post('/versions/:id/approve', authorize(ROLES.ZONAL_DEPT_HEAD), audit('report_version.approve', 'report_version'), c.approveVersion);

router.get('/', c.listTemplates);
// declared before "/:id" so it doesn't get swallowed by the id route
router.post('/for-version', templateEditors, validate(schemas.templatesForVersion), audit('template.bulk_create', 'template'), c.createTemplatesForVersion);
router.get('/:id', c.getTemplate);
router.post('/', templateEditors, validate(schemas.template), audit('template.create', 'template'), c.createTemplate);
router.put('/:id', templateEditors, validate(schemas.template), audit('template.update', 'template'), c.updateTemplate);
router.patch('/:id/active', authorize(ROLES.ZONAL_DEPT_HEAD), audit('template.set_active', 'template'), c.setTemplateActive);

export default router;
