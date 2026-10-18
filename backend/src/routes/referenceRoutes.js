import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import * as c from '../controllers/referenceController.js';

const router = Router();
router.use(authenticate);

router.get('/zones', c.listZones);
router.get('/zones/:zoneId/woredas', c.listWoredas);
router.get('/departments', c.listDepartments);
router.get('/departments/:departmentId/teams', c.listTeams);

// admin-only writes: grow / edit / retire the org hierarchy as the deployment expands
router.post('/zones', authorize(), validate(schemas.createZone), audit('zone.create', 'zone'), c.createZone);
router.patch('/zones/:zoneId', authorize(), validate(schemas.updateZone), audit('zone.update', 'zone'), c.updateZone);
router.delete('/zones/:zoneId', authorize(), audit('zone.delete', 'zone'), c.deleteZone);

router.post('/woredas', authorize(), validate(schemas.createWoreda), audit('woreda.create', 'woreda'), c.createWoreda);
router.patch('/woredas/:woredaId', authorize(), validate(schemas.updateWoreda), audit('woreda.update', 'woreda'), c.updateWoreda);
router.delete('/woredas/:woredaId', authorize(), audit('woreda.delete', 'woreda'), c.deleteWoreda);

router.post('/departments', authorize(), validate(schemas.createDepartment), audit('department.create', 'department'), c.createDepartment);
router.patch('/departments/:id', authorize(), validate(schemas.updateDepartment), audit('department.update', 'department'), c.updateDepartment);
router.delete('/departments/:id', authorize(), audit('department.delete', 'department'), c.deleteDepartment);

router.post('/teams', authorize(), validate(schemas.createTeam), audit('team.create', 'team'), c.createTeam);
router.patch('/teams/:id', authorize(), validate(schemas.updateTeam), audit('team.update', 'team'), c.updateTeam);
router.delete('/teams/:id', authorize(), audit('team.delete', 'team'), c.deleteTeam);

export default router;
