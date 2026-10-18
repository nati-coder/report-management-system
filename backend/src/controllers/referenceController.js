import Zone from '../models/Zone.js';
import Department from '../models/Department.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';

/** Read-only org hierarchy lookups (zones -> woredas, departments -> teams) for dropdowns. */
export const listZones = catchAsync(async (_req, res) => success(res, await Zone.listZones()));

export const listWoredas = catchAsync(async (req, res) => {
  const zones = await Zone.listZones();
  if (!zones.some((z) => z.zone_id === req.params.zoneId)) throw ApiError.notFound('Zone not found');
  success(res, await Zone.listWoredas(req.params.zoneId));
});

export const listDepartments = catchAsync(async (_req, res) => success(res, await Department.list()));

export const listTeams = catchAsync(async (req, res) => {
  const id = Number(req.params.departmentId);
  const depts = await Department.list();
  if (!depts.some((d) => d.id === id)) throw ApiError.notFound('Department not found');
  success(res, await Department.listTeams(id));
});

/** Admin-only: register a new zone. Lets the org hierarchy grow (e.g. regional expansion) without a DB migration. */
export const createZone = catchAsync(async (req, res) => {
  const zone = await Zone.createZone(req.body);
  created(res, zone, 'Zone created');
});

/** Admin-only: register a new woreda under an existing zone. */
export const createWoreda = catchAsync(async (req, res) => {
  if (!(await Zone.findZone(req.body.zone_id))) throw ApiError.badRequest('Unknown zone_id');
  const woreda = await Zone.createWoreda(req.body);
  created(res, woreda, 'Woreda created');
});

export const updateZone = catchAsync(async (req, res) => {
  const zone = await Zone.updateZone(req.params.zoneId, req.body);
  if (!zone) throw ApiError.notFound('Zone not found');
  success(res, zone, 'Zone updated');
});

/** Refuses to delete a zone that still has woredas, to avoid a silent cascade wipe of its woredas. */
export const deleteZone = catchAsync(async (req, res) => {
  const woredas = await Zone.listWoredas(req.params.zoneId);
  if (woredas.length) throw ApiError.conflict(`Cannot delete: ${woredas.length} woreda(s) still belong to this zone. Reassign or delete them first.`);
  await Zone.deleteZone(req.params.zoneId);
  success(res, null, 'Zone deleted');
});

export const updateWoreda = catchAsync(async (req, res) => {
  if (req.body.zone_id && !(await Zone.findZone(req.body.zone_id))) throw ApiError.badRequest('Unknown zone_id');
  const woreda = await Zone.updateWoreda(req.params.woredaId, req.body);
  if (!woreda) throw ApiError.notFound('Woreda not found');
  success(res, woreda, 'Woreda updated');
});

/** DB foreign keys (e.g. annual_plans) block this with a 409 if the woreda still has dependent records. */
export const deleteWoreda = catchAsync(async (req, res) => {
  await Zone.deleteWoreda(req.params.woredaId);
  success(res, null, 'Woreda deleted');
});

export const createDepartment = catchAsync(async (req, res) => {
  const dept = await Department.createDepartment(req.body);
  created(res, dept, 'Department created');
});

export const createTeam = catchAsync(async (req, res) => {
  if (!(await Department.findById(req.body.department_id))) throw ApiError.badRequest('Unknown department_id');
  const team = await Department.createTeam(req.body);
  created(res, team, 'Team created');
});

export const updateDepartment = catchAsync(async (req, res) => {
  const dept = await Department.updateDepartment(req.params.id, req.body);
  if (!dept) throw ApiError.notFound('Department not found');
  success(res, dept, 'Department updated');
});

/** Refuses to delete a department that still has teams, to avoid orphaning them (no DB-level FK on teams.department_id). */
export const deleteDepartment = catchAsync(async (req, res) => {
  const teams = await Department.listTeams(Number(req.params.id));
  if (teams.length) throw ApiError.conflict(`Cannot delete: ${teams.length} team(s) still belong to this department. Reassign or delete them first.`);
  await Department.deleteDepartment(req.params.id);
  success(res, null, 'Department deleted');
});

export const updateTeam = catchAsync(async (req, res) => {
  if (req.body.department_id && !(await Department.findById(req.body.department_id))) throw ApiError.badRequest('Unknown department_id');
  const team = await Department.updateTeam(req.params.id, req.body);
  if (!team) throw ApiError.notFound('Team not found');
  success(res, team, 'Team updated');
});

/** Refuses to delete a team that still has template node definitions, since that FK cascades and would wipe them silently. */
export const deleteTeam = catchAsync(async (req, res) => {
  const nodeCount = await Department.countReportFormats(Number(req.params.id));
  if (nodeCount) throw ApiError.conflict(`Cannot delete: ${nodeCount} report template node(s) still reference this team.`);
  await Department.deleteTeam(req.params.id);
  success(res, null, 'Team deleted');
});
