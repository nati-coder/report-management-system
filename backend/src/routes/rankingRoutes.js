import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { audit } from '../middlewares/auditLogger.js';
import { validate, schemas } from '../utils/validators.js';
import { ROLES, REVIEWER_ROLES } from '../constants/roles.js';
import * as c from '../controllers/rankingController.js';

const router = Router();
router.use(authenticate);

router.get('/teams', c.getTeamRankings);
router.post('/teams/score', authorize(...REVIEWER_ROLES), validate(schemas.teamScore), audit('team_feedback.create', 'report'), c.scoreReport);
router.post('/teams/compute', authorize(...REVIEWER_ROLES), validate(schemas.computeRanking), audit('team_ranking.compute', 'team_ranking'), c.computeTeamRankings);

router.get('/woredas', c.getWoredaRankings);
router.post('/woredas', authorize(ROLES.ZONAL_PLAN_EXPERT), validate(schemas.woredaRank), audit('woreda_ranking.set', 'woreda_ranking'), c.setWoredaRank);

export default router;
