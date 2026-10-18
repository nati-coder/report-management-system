import SupportRequest from '../models/SupportRequest.js';
import Zone from '../models/Zone.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES, WOREDA_ROLES } from '../constants/roles.js';
import { notify } from '../services/notificationService.js';

async function loadScoped(req) {
  const sr = await SupportRequest.findById(req.params.id);
  if (!sr) throw ApiError.notFound('Support request not found');
  const u = req.user;
  const allowed = u.role === ROLES.ADMIN
    || (WOREDA_ROLES.includes(u.role) ? sr.woreda_department_head_id === u.id : sr.zone_id === u.zone_id);
  if (!allowed) throw ApiError.forbidden('Not your support request');
  return sr;
}

export const listRequests = catchAsync(async (req, res) => {
  const u = req.user; const f = { status: req.query.status };
  if (u.role === ROLES.WOREDA_DEPT_HEAD) f.woreda_department_head_id = u.id;
  else if (u.role === ROLES.ZONAL_EXPERT || u.role === ROLES.ZONAL_PLAN_EXPERT) f.assigned_expert_id = u.id;
  else if (u.role === ROLES.ZONAL_DEPT_HEAD) f.zone_id = u.zone_id;
  success(res, await SupportRequest.list(f));
});

export const getRequest = catchAsync(async (req, res) => success(res, await loadScoped(req)));

export const createRequest = catchAsync(async (req, res) => {
  const woreda = await Zone.findWoreda(req.user.woreda_id);
  if (!woreda) throw ApiError.badRequest('Your account has no woreda');
  const [head] = await User.list({ role: ROLES.ZONAL_DEPT_HEAD, zone_id: woreda.zone_id, department_id: req.user.department_id, limit: 1 });
  const sr = await SupportRequest.create(req.body, req.user, woreda.zone_id, head?.id);
  await notify(head?.id, `New support request: ${sr.title}`, { support_request_id: sr.id });
  res.locals.auditTargetId = sr.id;
  created(res, sr, 'Support request created');
});

export const assignExpert = catchAsync(async (req, res) => {
  const sr = await loadScoped(req);
  const expert = await User.findById(req.body.assigned_expert_id);
  if (!expert || ![ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT].includes(expert.role) || expert.zone_id !== sr.zone_id) {
    throw ApiError.badRequest('Expert must be a zonal/plan expert in the same zone');
  }
  const updated = await SupportRequest.assign(sr.id, expert.id);
  await notify(expert.id, `You were assigned support request: ${sr.title}`, { support_request_id: sr.id });
  await notify(sr.woreda_department_head_id, `Expert assigned to: ${sr.title}`, { support_request_id: sr.id });
  success(res, updated, 'Expert assigned');
});

export const updateStatus = catchAsync(async (req, res) => {
  const sr = await loadScoped(req);
  const u = req.user;
  if (u.role !== ROLES.ADMIN && u.role !== ROLES.ZONAL_DEPT_HEAD && sr.assigned_expert_id !== u.id) {
    throw ApiError.forbidden('Only the assigned expert or zonal head can change status');
  }
  const updated = await SupportRequest.setStatus(sr.id, req.body.status);
  if (req.body.status === 'resolved') await notify(sr.woreda_department_head_id, `Request resolved: ${sr.title} — please rate the support`, { support_request_id: sr.id });
  success(res, updated, 'Status updated');
});

/** Woreda dept head rates the expert (1-5) once the request is resolved */
export const giveFeedback = catchAsync(async (req, res) => {
  const sr = await loadScoped(req);
  if (sr.woreda_department_head_id !== req.user.id) throw ApiError.forbidden('Only the requester can rate');
  if (!['resolved', 'closed'].includes(sr.status)) throw ApiError.badRequest('Request must be resolved first');
  if (!sr.assigned_expert_id) throw ApiError.badRequest('No expert assigned');
  if (await SupportRequest.feedbackExists(sr.id)) throw ApiError.conflict('Feedback already submitted');
  const fb = await SupportRequest.addFeedback({ support_request_id: sr.id, expert_id: sr.assigned_expert_id, given_by: req.user.id, ...req.body });
  await SupportRequest.setStatus(sr.id, 'closed');
  created(res, fb, 'Thanks for your feedback');
});

export const expertRating = catchAsync(async (req, res) => success(res, await SupportRequest.expertRatings(req.params.expertId)));
