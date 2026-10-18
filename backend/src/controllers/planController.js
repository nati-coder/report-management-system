import Plan from '../models/Plan.js';
import ZonePlan from '../models/ZonePlan.js';
import ReportFormat from '../models/ReportFormat.js';
import Zone from '../models/Zone.js';
import User from '../models/User.js';
import { buildTableXlsx } from '../services/tableExportService.js';
import catchAsync from '../utils/catchAsync.js';
import { success, ApiError } from '../utils/apiResponse.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES } from '../constants/roles.js';
import { notifyMany } from '../services/notificationService.js';
import { templateScope, woredaPlanScope, inScope, OUT_OF_SCOPE } from '../utils/scope.js';
import { indicatorsOf } from '../utils/formatTree.js';
import { hierarchyOf, hierarchyErrors, zoneTotalErrors, monthlyTotalErrors } from '../utils/planChecks.js';
import { buildOverview } from '../utils/planOverview.js';

const num = (v) => (v ? Number(v) : undefined);

// A monthly plan covers July → June; `month` is the calendar month number (July = 7 … June = 6).
const MONTH_NAMES = { 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' };
const PLAN_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

/** Plans visible to the caller: woreda users see only their own woreda's cascaded plans; zonal users their zone's. */
export const listPlans = catchAsync(async (req, res) => {
  const { format_id, year, woreda_id, status, period } = req.query;
  // Annual plans unless the monthly ones are asked for — the two share a table and must not be mixed up.
  const f = { format_id: num(format_id), year: num(year), status, ...(period === 'monthly' ? { monthly: true } : { annual: true }) };
  const u = req.user;

  if (WOREDA_ROLES.includes(u.role)) {
    const scope = woredaPlanScope(u);
    if (!u.woreda_id || !scope) return success(res, []);
    f.woredaIds = [u.woreda_id];
    f.department_id = scope.department_id;
    if (scope.team_id) f.team_id = scope.team_id;
    f.excludeDraft = true; // drafts are the zonal expert's working copy
  } else {
    if (ZONAL_ROLES.includes(u.role)) {
      const scope = templateScope(u);
      if (!u.zone_id || !scope) return success(res, []);
      f.zone_id = u.zone_id;
      f.department_id = scope.department_id;
      if (scope.team_id) f.team_id = scope.team_id;
    }
    if (woreda_id) f.woredaIds = [woreda_id];
  }
  success(res, await Plan.list(f));
});

const CASCADED = ['submitted', 'approved'];
const inconsistent = (problems) => ApiError.badRequest('The plan does not add up', problems);

/** An approved format the caller is allowed to plan against. */
async function approvedFormat(user, format_id) {
  const format = await ReportFormat.findById(format_id);
  if (!format) throw ApiError.notFound('Report format not found');
  if (format.status !== 'approved') throw ApiError.conflict('Annual plans can only be made from an approved report format');
  if (!inScope(templateScope(user), format)) throw ApiError.forbidden(OUT_OF_SCOPE);
  return format;
}

/** Which zone a request is about: your own, or (admin) the one you name. */
async function zoneFor(user, requested) {
  let zoneId;
  if (user.role === ROLES.ADMIN) {
    if (!requested) throw ApiError.badRequest('zone_id is required');
    zoneId = requested;
  } else {
    if (!user.zone_id) throw ApiError.forbidden('Your account has no zone');
    zoneId = user.zone_id;
  }
  if (!(await Zone.findZone(zoneId))) throw ApiError.badRequest('Unknown zone');
  return zoneId;
}

/** Keep only real, valid targets: numbers, never negative, percentages 0–100; blank = no target. */
function cleanData(indicators, raw, who) {
  const data = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const item = indicators.get(key);
    if (!item) throw ApiError.badRequest(`"${key}" is not an item with a measurement in this report format`);
    if (value === null || value === '' || value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw ApiError.badRequest(`${who}: ${item.label} must be a number`);
    const lo = Math.max(item.min ?? 0, 0); // a target is never negative
    if (value < lo) throw ApiError.badRequest(`${who}: ${item.label} cannot be below ${lo}`);
    if (item.max != null && value > item.max) throw ApiError.badRequest(`${who}: ${item.label} cannot exceed ${item.max}`);
    data[key] = value;
  }
  return data;
}

/** The woredas of a zone and which of them already have a cascaded annual plan for this format + year. */
async function cascadedState(format, zoneId, year) {
  const woredas = await Zone.listWoredas(zoneId);
  const plans = await Plan.list({ format_id: format.id, zone_id: zoneId, year, annual: true });
  return { woredas, cascaded: plans.filter((p) => CASCADED.includes(p.status)) };
}

/** Zonal Expert / Admin: the zone plan for a format + year (null if none has been saved yet). */
export const getZonePlan = catchAsync(async (req, res) => {
  const { format_id, year, zone_id } = req.query;
  if (WOREDA_ROLES.includes(req.user.role)) throw ApiError.forbidden('The zone plan is not available to woreda users');
  if (!format_id || !year) throw ApiError.badRequest('format_id and year are required');
  const format = await ReportFormat.findById(Number(format_id));
  if (!format) throw ApiError.notFound('Report format not found');
  if (!inScope(templateScope(req.user), format)) throw ApiError.forbidden(OUT_OF_SCOPE);
  const zoneId = await zoneFor(req.user, zone_id);
  success(res, await ZonePlan.find({ format_id: format.id, zone_id: zoneId, year: Number(year) }));
});

/**
 * Zonal Expert: step 1 — save the zone's annual targets. A saved zone plan is always consistent:
 * every parent equals the sum of its sub-items, and it can't be set below what woredas have already been cascaded.
 */
export const saveZonePlan = catchAsync(async (req, res) => {
  const { format_id, year } = req.body;
  const format = await approvedFormat(req.user, format_id);
  const zoneId = await zoneFor(req.user, req.body.zone_id);

  const indicatorList = indicatorsOf(format.schema_definition);
  const indicators = new Map(indicatorList.map((i) => [i.key, i]));
  const data = cleanData(indicators, req.body.data, 'Zone plan');
  if (!Object.keys(data).length) throw ApiError.badRequest('Enter at least one target');

  const problems = hierarchyErrors(hierarchyOf(format.schema_definition), data);

  // …and stay consistent with the woredas already cascaded against it
  const { woredas, cascaded } = await cascadedState(format, zoneId, year);
  const complete = woredas.length > 0 && woredas.every((w) => cascaded.some((p) => p.woreda_id === w.woreda_id));
  problems.push(...zoneTotalErrors({ indicators: indicatorList, zoneData: data, plans: cascaded, complete }));
  if (problems.length) throw inconsistent(problems);

  const row = await ZonePlan.upsert({ format_id: format.id, zone_id: zoneId, team_id: format.team_id, year, data }, req.user.id);
  success(res, row, 'Zone plan saved');
});

/**
 * Zonal Expert: step 2 — plan woredas against the zone plan. Drafts are saved as they are.
 * Cascading (submit = true) also checks, for the woredas being cascaded:
 *   - every parent equals the sum of its sub-items;
 *   - the woredas' targets don't exceed the zone plan, and match it exactly once every woreda of the zone is planned.
 * Cascading notifies the woreda and locks its plan.
 */
export const cascadePlans = catchAsync(async (req, res) => {
  const { format_id, year, submit, allocations } = req.body;
  const u = req.user;
  const format = await approvedFormat(u, format_id);

  const indicatorList = indicatorsOf(format.schema_definition);
  const indicators = new Map(indicatorList.map((i) => [i.key, i]));

  const seen = new Set();
  const woredaOf = new Map();
  const items = [];
  for (const a of allocations) {
    if (seen.has(a.woreda_id)) throw ApiError.badRequest(`Woreda ${a.woreda_id} appears more than once`);
    seen.add(a.woreda_id);
    const woreda = await Zone.findWoreda(a.woreda_id);
    if (!woreda) throw ApiError.badRequest(`Unknown woreda ${a.woreda_id}`);
    if (u.role !== ROLES.ADMIN && woreda.zone_id !== u.zone_id) throw ApiError.forbidden(`${woreda.name} is outside your zone`);
    woredaOf.set(a.woreda_id, woreda);
    items.push({ woreda_id: a.woreda_id, data: cleanData(indicators, a.data, woreda.name) });
  }
  const zones = new Set([...woredaOf.values()].map((w) => w.zone_id));
  if (zones.size > 1) throw ApiError.badRequest('Plan one zone at a time');
  const zoneId = [...zones][0];

  // Step 1 must come first, and woredas are planned only for what the zone plan covers.
  const zonePlan = await ZonePlan.find({ format_id: format.id, zone_id: zoneId, year });
  if (!zonePlan) throw ApiError.conflict('Enter and save the zone plan first, then plan the woredas against it');
  for (const it of items) {
    for (const key of Object.keys(it.data)) {
      if (zonePlan.data[key] === undefined) {
        throw ApiError.badRequest(`${woredaOf.get(it.woreda_id).name}: ${indicators.get(key).label} is not part of the zone plan`);
      }
    }
  }

  if (submit) {
    const problems = [];
    const parents = hierarchyOf(format.schema_definition);
    for (const it of items) {
      for (const e of hierarchyErrors(parents, it.data)) problems.push(`${woredaOf.get(it.woreda_id).name}: ${e}`);
    }
    const { woredas, cascaded } = await cascadedState(format, zoneId, year);
    const inRequest = new Set(items.map((i) => i.woreda_id));
    const others = cascaded.filter((p) => !inRequest.has(p.woreda_id));
    const complete = woredas.length > 0 && woredas.every((w) => inRequest.has(w.woreda_id) || others.some((p) => p.woreda_id === w.woreda_id));
    problems.push(...zoneTotalErrors({
      indicators: indicatorList, zoneData: zonePlan.data, plans: [...others, ...items], complete,
    }));
    if (problems.length) throw inconsistent(problems);
  }

  const saved = await Plan.cascadeMany({
    format_id: format.id, team_id: format.team_id, year, items, status: submit ? 'submitted' : 'draft',
  }, u.id);

  if (submit) {
    for (const it of items) {
      const heads = await User.list({ role: ROLES.WOREDA_DEPT_HEAD, woreda_id: it.woreda_id, department_id: format.department_id, limit: 20 });
      await notifyMany(heads.map((h) => h.id), `Annual plan cascaded to your woreda: ${format.template_title} (${year})`, { format_id: format.id, year });
    }
  }
  success(res, saved, submit ? `Annual plan cascaded to ${saved.length} woreda(s)` : `Saved ${saved.length} draft plan(s)`);
});

/**
 * Woreda Dept Head: accept or reject the annual plan cascaded to their woreda. Only a plan that has been
 * cascaded and not yet decided can be decided; accepting locks it for good, rejecting sends it back to the
 * zonal expert (with the reason), who may revise it and cascade again.
 */
export const reviewPlan = catchAsync(async (req, res) => {
  const { action, rejection_reason } = req.body;
  const u = req.user;
  const plan = await Plan.findById(Number(req.params.id));
  if (!plan) throw ApiError.notFound('Plan not found');
  if (plan.month !== null || plan.quarter !== null) throw ApiError.badRequest('Only an annual plan can be accepted or rejected');

  const format = await ReportFormat.findById(plan.format_id);
  if (u.role !== ROLES.ADMIN) {
    if (!u.woreda_id || plan.woreda_id !== u.woreda_id) throw ApiError.forbidden('This plan belongs to another woreda');
    if (!u.department_id || format?.department_id !== u.department_id) throw ApiError.forbidden(OUT_OF_SCOPE);
  }
  if (action === 'reject' && !rejection_reason?.trim()) throw ApiError.badRequest('A reason is required when rejecting');

  const updated = await Plan.decide(plan.id, { approve: action === 'approve', reviewerId: u.id, rejection_reason: rejection_reason?.trim() });
  if (!updated) throw ApiError.conflict('Only a cascaded plan that has not been answered yet can be accepted or rejected');

  // Tell whoever planned it: the author, and the zonal experts of that team in the zone.
  const woreda = await Zone.findWoreda(plan.woreda_id);
  const experts = woreda ? await User.list({ role: ROLES.ZONAL_EXPERT, zone_id: woreda.zone_id, team_id: plan.team_id, limit: 50 }) : [];
  const verb = updated.status === 'approved' ? 'accepted' : 'rejected';
  const why = updated.status === 'rejected' ? ` — ${updated.rejection_reason}` : '';
  await notifyMany([plan.created_by, ...experts.map((e) => e.id)],
    `${woreda?.name ?? plan.woreda_id} ${verb} the ${plan.year} annual plan: ${format?.template_title}${why}`,
    { format_id: plan.format_id, year: plan.year, plan_id: plan.id });

  res.locals.auditTargetId = plan.id;
  success(res, updated, `Plan ${verb}`);
});

/**
 * Zonal Expert: the monthly plan of one woreda — its cascaded annual targets divided across the twelve months,
 * whether the expert split them automatically or typed them. Drafts are saved as they are. Cascading (submit = true)
 * also checks that every parent equals the sum of its sub-items in each month, and that the months add up exactly
 * to the annual plan (percentages are rates: each month just has to be 0–100). Cascading notifies the woreda and locks it.
 */
export const saveMonthlyPlan = catchAsync(async (req, res) => {
  const { format_id, year, woreda_id, submit } = req.body;
  const u = req.user;
  const format = await approvedFormat(u, format_id);
  const woreda = await Zone.findWoreda(woreda_id);
  if (!woreda) throw ApiError.badRequest(`Unknown woreda ${woreda_id}`);
  if (u.role !== ROLES.ADMIN && woreda.zone_id !== u.zone_id) throw ApiError.forbidden(`${woreda.name} is outside your zone`);

  // The annual plan comes first, and must already have been cascaded to the woreda.
  const [annual] = await Plan.list({ format_id: format.id, woredaIds: [woreda_id], year, annual: true });
  if (!annual || !CASCADED.includes(annual.status)) {
    throw ApiError.conflict(`Cascade ${woreda.name}'s annual plan first — the monthly plan divides it`);
  }

  const indicatorList = indicatorsOf(format.schema_definition);
  const indicators = new Map(indicatorList.map((i) => [i.key, i]));
  const seen = new Set();
  const byMonth = new Map();
  for (const m of req.body.months) {
    if (seen.has(m.month)) throw ApiError.badRequest(`${MONTH_NAMES[m.month]} appears more than once`);
    seen.add(m.month);
    const data = cleanData(indicators, m.data, MONTH_NAMES[m.month]);
    for (const key of Object.keys(data)) {
      if (annual.data[key] === undefined) throw ApiError.badRequest(`${MONTH_NAMES[m.month]}: ${indicators.get(key).label} is not part of the annual plan`);
    }
    byMonth.set(m.month, data);
  }
  const months = PLAN_MONTHS.map((n) => ({ month: n, data: byMonth.get(n) ?? {} }));

  if (submit) {
    const problems = [];
    const parents = hierarchyOf(format.schema_definition);
    for (const m of months) for (const e of hierarchyErrors(parents, m.data)) problems.push(`${MONTH_NAMES[m.month]}: ${e}`);
    problems.push(...monthlyTotalErrors({ indicators: indicatorList, annualData: annual.data, months, complete: true }));
    if (problems.length) throw ApiError.badRequest('The monthly plan does not add up', problems);
  }

  const saved = await Plan.saveMonthly({
    format_id: format.id, team_id: format.team_id, woreda_id, year, months, status: submit ? 'submitted' : 'draft',
  }, u.id);

  if (submit) {
    const heads = await User.list({ role: ROLES.WOREDA_DEPT_HEAD, woreda_id, department_id: format.department_id, limit: 20 });
    await notifyMany(heads.map((h) => h.id), `Monthly plan cascaded to your woreda: ${format.template_title} (${year})`, { format_id: format.id, year });
  }
  success(res, saved, submit ? `Monthly plan cascaded to ${woreda.name}` : `Saved ${woreda.name}'s monthly draft`);
});

/**
 * Zonal Expert: Excel file of a plan table the browser is showing (CSV and printing happen in the browser).
 * Nothing is read from the database, so there is nothing here to scope — it only formats what it is sent.
 */
export const exportPlanTable = catchAsync(async (req, res) => {
  const t = req.body;
  if (t.rows.some((r) => r.cells.length > t.columns.length)) throw ApiError.badRequest('A row has more cells than the table has columns');
  const buf = await buildTableXlsx(t);
  res.set('Content-Disposition', 'attachment; filename="plan-table.xlsx"');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});
