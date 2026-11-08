import Feedback from '../models/Feedback.js';
import Report from '../models/Report.js';
import ReportFormat from '../models/ReportFormat.js';
import Zone from '../models/Zone.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES } from '../constants/roles.js';
import { canAccessWoreda } from '../middlewares/rbacMiddleware.js';
import { assertReportAccess } from '../utils/reportAccess.js';
import { templateScope, woredaPlanScope, inScope, OUT_OF_SCOPE } from '../utils/scope.js';

/**
 * Reviewer feedback (written, no score). Who writes what:
 *   woreda_report / woreda_plan / zone_plan   Zonal Expert and Team Leader (for their own team's formats) — and the admin
 *   department_report / department_plan      Zonal Dept Head (for their own department, all teams at once) — and the admin
 * Reading follows the same access as the thing it is about; woreda users can read feedback on their own woreda's
 * reports and plans, but never the zone plan's or the department's.
 */
const TEAM_WRITERS = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER];
const WRITERS = {
  woreda_report: TEAM_WRITERS,
  woreda_plan: TEAM_WRITERS,
  zone_plan: TEAM_WRITERS,
  department_report: [ROLES.ZONAL_DEPT_HEAD],
  department_plan: [ROLES.ZONAL_DEPT_HEAD],
};
/** A report can be commented on once it is with the zone and under or past review. */
const REVIEWED = ['reviewing', 'approved'];

async function zoneOf(user, requested) {
  const zoneId = user.role === ROLES.ADMIN ? requested : user.zone_id;
  if (!zoneId) throw ApiError.badRequest(user.role === ROLES.ADMIN ? 'zone_id is required' : 'Your account has no zone');
  if (!(await Zone.findZone(zoneId))) throw ApiError.badRequest('Unknown zone');
  return zoneId;
}

async function formatFor(user, formatId) {
  const format = formatId ? await ReportFormat.findById(Number(formatId)) : null;
  if (!format) throw ApiError.badRequest('A report format is required');
  if (user.role !== ROLES.ADMIN) {
    const scope = WOREDA_ROLES.includes(user.role) ? woredaPlanScope(user) : templateScope(user);
    if (!inScope(scope, format)) throw ApiError.forbidden(OUT_OF_SCOPE);
  }
  return format;
}

/**
 * Work out what the request is about — and check the caller may see it. Returns the filter that identifies the
 * subject (used for both reading and writing) plus the extra columns to store on write.
 */
async function resolveSubject(user, q, { writing }) {
  const { kind } = q;
  const year = q.year ? Number(q.year) : undefined;
  const woredaUser = WOREDA_ROLES.includes(user.role);

  if (kind === 'woreda_report') {
    const report = q.report_id ? await Report.findById(Number(q.report_id)) : null;
    if (!report) throw ApiError.notFound('Report not found');
    const format = await assertReportAccess(user, report);
    if (writing && !REVIEWED.includes(report.status)) throw ApiError.conflict('Feedback is given once the report is under review or approved');
    return { filter: { report_id: report.id }, store: { report_id: report.id, format_id: report.format_id, team_id: format?.team_id, department_id: format?.department_id, woreda_id: report.woreda_id, year: report.year } };
  }

  if (kind === 'woreda_plan') {
    if (!q.woreda_id || !year) throw ApiError.badRequest('woreda_id and year are required');
    if (!(await canAccessWoreda(user, q.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
    const format = await formatFor(user, q.format_id);
    const woreda = await Zone.findWoreda(q.woreda_id);
    return { filter: { format_id: format.id, woreda_id: q.woreda_id, year }, store: { format_id: format.id, team_id: format.team_id, department_id: format.department_id, zone_id: woreda?.zone_id, woreda_id: q.woreda_id, year } };
  }

  if (kind === 'zone_plan') {
    if (woredaUser) throw ApiError.forbidden('The zone plan is not available to woreda users');
    if (!year) throw ApiError.badRequest('year is required');
    const format = await formatFor(user, q.format_id);
    const zoneId = await zoneOf(user, q.zone_id);
    return { filter: { format_id: format.id, zone_id: zoneId, year }, store: { format_id: format.id, team_id: format.team_id, department_id: format.department_id, zone_id: zoneId, year } };
  }

  if (kind === 'department_report' || kind === 'department_plan') {
    if (woredaUser) throw ApiError.forbidden('Department feedback is for the zone');
    if (!year || !q.period) throw ApiError.badRequest('year and period are required');
    const departmentId = user.role === ROLES.ADMIN ? Number(q.department_id) : user.department_id;
    if (!departmentId) throw ApiError.badRequest(user.role === ROLES.ADMIN ? 'department_id is required' : 'Your account has no department');
    if (user.role !== ROLES.ADMIN && ZONAL_ROLES.includes(user.role) && q.department_id && Number(q.department_id) !== user.department_id) throw ApiError.forbidden(OUT_OF_SCOPE);
    const zoneId = await zoneOf(user, q.zone_id);
    return { filter: { department_id: departmentId, zone_id: zoneId, year, period: String(q.period) }, store: { department_id: departmentId, zone_id: zoneId, year, period: String(q.period) } };
  }

  throw ApiError.badRequest('Unknown feedback kind');
}

export const listFeedback = catchAsync(async (req, res) => {
  if (!WRITERS[req.query.kind]) throw ApiError.badRequest('Unknown feedback kind');
  const { filter } = await resolveSubject(req.user, req.query, { writing: false });
  success(res, await Feedback.list({ kind: req.query.kind, ...filter }));
});

export const addFeedback = catchAsync(async (req, res) => {
  const { kind } = req.body;
  if (req.user.role !== ROLES.ADMIN && !WRITERS[kind].includes(req.user.role)) throw ApiError.forbidden('You do not give this kind of feedback');
  const { store } = await resolveSubject(req.user, req.body, { writing: true });
  created(res, await Feedback.create({ kind, ...store, body: req.body.body }, req.user), 'Feedback saved');
});
