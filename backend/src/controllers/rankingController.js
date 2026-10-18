import Ranking from '../models/Ranking.js';
import Report from '../models/Report.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { canAccessWoreda } from '../middlewares/rbacMiddleware.js';
import { computeTeamRanking } from '../services/rankingEngineService.js';
import { ROLES } from '../constants/roles.js';

export const scoreReport = catchAsync(async (req, res) => {
  const report = await Report.findById(req.body.report_id);
  if (!report) throw ApiError.notFound('Report not found');
  if (!(await canAccessWoreda(req.user, report.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  if (req.body.score > req.body.max_score) throw ApiError.badRequest('score cannot exceed max_score');
  const fb = await Ranking.addTeamFeedback(req.body, req.user.id);
  created(res, fb, 'Score recorded');
});

export const computeTeamRankings = catchAsync(async (req, res) => {
  if (!(await canAccessWoreda(req.user, req.body.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  success(res, await computeTeamRanking(req.body), 'Team ranking computed');
});

export const getTeamRankings = catchAsync(async (req, res) => {
  const { woreda_id, period_type, year, month, quarter } = req.query;
  if (!woreda_id || !period_type || !year) throw ApiError.badRequest('woreda_id, period_type and year are required');
  if (!(await canAccessWoreda(req.user, woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  success(res, await Ranking.listTeamRanking({
    woreda_id, period_type, year: Number(year),
    month: month ? Number(month) : null, quarter: quarter ? Number(quarter) : null,
  }));
});

/** Manual woreda ranking by Plan Experts */
export const setWoredaRank = catchAsync(async (req, res) => {
  if (!(await canAccessWoreda(req.user, req.body.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  success(res, await Ranking.upsertWoredaRank(req.body, req.user.id), 'Woreda rank saved');
});

export const getWoredaRankings = catchAsync(async (req, res) => {
  const { year, period_type } = req.query;
  if (!year || !period_type) throw ApiError.badRequest('year and period_type are required');
  const zone_id = req.user.role === ROLES.ADMIN ? req.query.zone_id : req.user.zone_id;
  success(res, await Ranking.listWoredaRanking({ zone_id, year: Number(year), period_type }));
});
