import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import * as c from '../controllers/rankController.js';

/**
 * Achievement ranking (read-only, computed live from plans and reports).
 *   GET /rank/woredas?year=&period=&zone_id=&department_id=&mode=overall            Woreda Rank — overall, department level
 *   GET /rank/woredas?year=&period=&zone_id=&department_id=&mode=team&team_id=       Woreda Rank — by one team (no team_id: every team of the department)
 *   GET /rank/teams?year=&period=&zone_id=&department_id=                            Team Rank — teams across the zone
 * period = month (+ &month=7…6) | q1…q4 | h1 | h2 | annual (default); optional &cap=100.
 * zone_id / department_id are only for the admin; everyone else is held to the zone and department on their account.
 */
const router = Router();
router.use(authenticate);
router.get('/woredas', c.woredaRank);
router.get('/teams', c.teamRank);
export default router;
