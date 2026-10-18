import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/userController.js';

const router = Router();
router.use(authenticate);

router.get('/reference-data', c.referenceData);
router.get('/', authorize(ROLES.ZONAL_DEPT_HEAD), c.listUsers);
router.get('/:id', authorize(ROLES.ZONAL_DEPT_HEAD), c.getUser);
router.post('/', authorize(), validate(schemas.createUser), audit('user.create', 'user'), c.createUser);
router.patch('/:id', authorize(), validate(schemas.updateUser), audit('user.update', 'user'), c.updateUser);
router.post('/:id/reset-password', authorize(), validate(schemas.adminSetPassword), audit('user.reset_password', 'user'), c.resetPassword);

export default router;
