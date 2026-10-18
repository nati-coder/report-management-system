import ReportFormat from '../models/ReportFormat.js';
import Template from '../models/Template.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES } from '../constants/roles.js';
import { notifyMany } from '../services/notificationService.js';
import { templateScope, inScope, OUT_OF_SCOPE } from '../utils/scope.js';
import { rowsOf } from '../utils/formatTree.js';
import { buildCsv, buildXlsx } from '../services/formatExportService.js';

const num = (v) => (v ? Number(v) : undefined);

/** Throws unless the template/format is inside the caller's department (and team, for experts / team leaders). */
const assertInScope = (user, resource) => {
  if (!inScope(templateScope(user), resource)) throw ApiError.forbidden(OUT_OF_SCOPE);
};

async function load(id) {
  const f = await ReportFormat.findById(id);
  if (!f) throw ApiError.notFound('Report format not found');
  return f;
}

export const listFormats = catchAsync(async (req, res) => {
  const { template_id, status, department_id, team_id, version_id } = req.query;
  // Zonal users only get formats of their own department (and team, if they have one);
  // filters they send can narrow that further, never widen it.
  const scope = templateScope(req.user);
  if (!scope) return success(res, []);
  success(res, await ReportFormat.list({
    template_id: num(template_id), status,
    department_id: scope.department_id ?? num(department_id),
    team_id: scope.team_id ?? num(team_id),
    version_id: num(version_id),
  }));
});

export const getFormat = catchAsync(async (req, res) => {
  const f = await load(req.params.id);
  assertInScope(req.user, f);
  success(res, f);
});

/** Zonal Expert / Zonal Team Leader: create a draft format for a report template. */
export const createFormat = catchAsync(async (req, res) => {
  const tpl = await Template.findById(req.body.template_id);
  if (!tpl) throw ApiError.badRequest('Unknown template_id');
  if (!tpl.active_flag) throw ApiError.badRequest('This report template is inactive');
  assertInScope(req.user, tpl);

  const f = await ReportFormat.create(req.body, req.user.id);
  res.locals.auditTargetId = f.id;
  created(res, f, 'Report format created');
});

export const updateFormat = catchAsync(async (req, res) => {
  const f = await load(req.params.id);
  assertInScope(req.user, f);
  const updated = await ReportFormat.updateSchema(f.id, req.body.schema_definition);
  if (!updated) throw ApiError.conflict('Only draft or rejected report formats can be edited');
  success(res, updated, 'Report format saved');
});

export const submitFormat = catchAsync(async (req, res) => {
  const f = await load(req.params.id);
  assertInScope(req.user, f);
  const updated = await ReportFormat.submitForApproval(f.id);
  if (!updated) throw ApiError.conflict('Only draft report formats can be submitted for approval');

  if (f.department_id) {
    const heads = await User.list({ role: ROLES.ZONAL_DEPT_HEAD, department_id: f.department_id, limit: 100 });
    await notifyMany(heads.map((h) => h.id), `Report format awaiting your approval: ${f.template_title}`, { report_format_id: f.id });
  }
  success(res, updated, 'Submitted for approval');
});

/** Zonal Dept Head: approve or reject a format that is pending approval. */
export const reviewFormat = catchAsync(async (req, res) => {
  const { action, rejection_reason } = req.body;
  const f = await load(req.params.id);
  assertInScope(req.user, f);
  if (action === 'reject' && !rejection_reason?.trim()) throw ApiError.badRequest('A reason is required when rejecting');

  const updated = await ReportFormat.decide(f.id, { approve: action === 'approve', reviewerId: req.user.id, rejection_reason });
  if (!updated) throw ApiError.conflict('Only report formats pending approval can be reviewed');

  await notifyMany([f.created_by], `Your report format "${f.template_title}" was ${updated.status}`, { report_format_id: f.id });
  success(res, updated, `Report format ${updated.status}`);
});

const slug = (v) => String(v).normalize('NFC').replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report-format';

/**
 * Download an approved format as Excel (?type=xlsx) or CSV (?type=csv). Same visibility rules as opening
 * it, and only approved formats — what is handed out is the format that is actually in force.
 */
export const exportFormat = catchAsync(async (req, res) => {
  const { type } = req.query;
  if (!['xlsx', 'csv'].includes(type)) throw ApiError.badRequest('type must be "xlsx" or "csv"');
  const f = await load(req.params.id);
  assertInScope(req.user, f);
  if (f.status !== 'approved') throw ApiError.conflict('Only approved report formats can be downloaded');

  const rows = rowsOf(f.schema_definition);
  const name = `${slug(f.template_title)}-v${f.version}.${type}`;
  const ascii = `report-format-${f.id}-v${f.version}.${type}`;
  res.set('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);

  if (type === 'csv') {
    res.type('text/csv; charset=utf-8');
    return res.send(buildCsv(rows));
  }
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(await buildXlsx(f, rows));
});
