import Template from '../models/Template.js';
import Department from '../models/Department.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES } from '../constants/roles.js';
import { templateScope, inScope, OUT_OF_SCOPE } from '../utils/scope.js';

const deptGuard = (user, deptId) => {
  if (user.role !== ROLES.ADMIN && deptId && user.department_id !== deptId) {
    throw ApiError.forbidden('Template belongs to another department');
  }
};

/**
 * Order-independent deep equality for plain JSON values. Needed because
 * Postgres JSONB does not preserve the original key order of what was
 * inserted — a round-tripped, semantically-identical object can come back
 * with its keys reordered, so a plain JSON.stringify comparison would
 * false-positive on every read and incorrectly lock metadata-only edits.
 */
const jsonEqual = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  }
  const aKeys = Object.keys(a); const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]));
};

export const listTemplates = catchAsync(async (req, res) => {
  const { type, department_id, team_id, version_id, active } = req.query;
  // A zonal user only gets templates of their own department (and team, if they have one) —
  // whatever filters they send can only narrow that further, never widen it.
  const scope = templateScope(req.user);
  if (!scope) return success(res, []);
  success(res, await Template.list({
    type,
    department_id: scope.department_id ?? (department_id ? Number(department_id) : undefined),
    team_id: scope.team_id ?? (team_id ? Number(team_id) : undefined),
    version_id: version_id ? Number(version_id) : undefined,
    active: active === undefined ? undefined : active === 'true',
  }));
});

export const getTemplate = catchAsync(async (req, res) => {
  const t = await Template.findById(req.params.id);
  if (!t) throw ApiError.notFound('Template not found');
  if (!inScope(templateScope(req.user), t)) throw ApiError.forbidden(OUT_OF_SCOPE);
  success(res, t);
});

export const createTemplate = catchAsync(async (req, res) => {
  deptGuard(req.user, req.body.department_id);

  const version = await Template.findVersionById(req.body.version_id);
  if (!version) throw ApiError.badRequest('Unknown version_id');
  const team = await Department.findTeam(req.body.team_id);
  if (!team) throw ApiError.badRequest('Unknown team_id');
  if (team.department_id !== version.dep_id) {
    throw ApiError.badRequest('The selected team does not belong to this report version\'s department');
  }

  // One template per (version_id, team_id) — see also the DB-level unique
  // constraint added by migration 0002, which closes the race-condition
  // window this check alone can't fully cover.
  const [dup] = await Template.list({ version_id: req.body.version_id, team_id: req.body.team_id });
  if (dup) throw ApiError.conflict('A template already exists for this team under this report version.');

  const t = await Template.create(req.body, req.user.id);
  res.locals.auditTargetId = t.id;
  created(res, t, 'Template created');
});

export const updateTemplate = catchAsync(async (req, res) => {
  const existing = await Template.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Template not found');
  deptGuard(req.user, existing.department_id);

  // Once a report has been submitted against this template's format chain,
  // the KPI structure is locked — changing it would silently invalidate
  // already-submitted data. Metadata (title, end_year, etc.) stays editable.
  const schemaChanged = !jsonEqual(req.body.json_schema, existing.json_schema);
  if (schemaChanged && await Template.hasSubmittedReports(existing.id)) {
    throw ApiError.conflict('This template already has submitted reports against it — its KPI structure can no longer be changed. Create a new report version instead.');
  }

  success(res, await Template.update(req.params.id, req.body), 'Template updated');
});

export const setTemplateActive = catchAsync(async (req, res) => {
  const t = await Template.setActive(req.params.id, Boolean(req.body.active), req.user.id);
  if (!t) throw ApiError.notFound('Template not found');
  success(res, t);
});

/** Zonal Plan Expert: create a report_templates row for every team in a report version's department. */
export const createTemplatesForVersion = catchAsync(async (req, res) => {
  const version = await Template.findVersionById(req.body.version_id);
  if (!version) throw ApiError.notFound('Report version not found');
  deptGuard(req.user, version.dep_id);

  const result = await Template.createForAllTeams({
    version_id: version.id,
    dep_id: version.dep_id,
    title: req.body.title,
    type: req.body.type,
    start_year: req.body.start_year,
    end_year: req.body.end_year,
    templateVersion: req.body.templateVersion,
  }, req.user.id);

  success(res, result, `Created ${result.created.length} template(s)${result.skipped ? `, skipped ${result.skipped} team(s) that already had one` : ''}`);
});

export const listVersions = catchAsync(async (req, res) =>
  success(res, await Template.listVersions(req.query.dep_id ? Number(req.query.dep_id) : undefined)));

export const getVersion = catchAsync(async (req, res) => {
  const v = await Template.getVersionTree(req.params.id, req.query.team_id ? Number(req.query.team_id) : undefined);
  if (!v) throw ApiError.notFound('Report version not found');
  success(res, v);
});

export const createVersion = catchAsync(async (req, res) => {
  deptGuard(req.user, req.body.dep_id);
  const v = await Template.createVersion(req.body, req.user.id);
  res.locals.auditTargetId = v.id;
  created(res, v, 'Report version created');
});

export const approveVersion = catchAsync(async (req, res) => {
  const v = await Template.approveVersion(req.params.id, req.user.id);
  if (!v) throw ApiError.notFound('Report version not found');
  success(res, v, 'Report version approved');
});
