import Report from '../models/Report.js';
import ReportFormat from '../models/ReportFormat.js';
import Plan from '../models/Plan.js';
import Zone from '../models/Zone.js';
import ReportWindow from '../models/ReportWindow.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES, REVIEWER_ROLES } from '../constants/roles.js';
import { STATUS, TRANSITIONS } from '../constants/status.js';
import { canAccessWoreda } from '../middlewares/rbacMiddleware.js';
import { notify } from '../services/notificationService.js';
import { woredaPlanScope, templateScope, inScope, OUT_OF_SCOPE } from '../utils/scope.js';
import { indicatorsOf } from '../utils/formatTree.js';
import { MONTH_NAMES, RANGES, COUNTED, summarise, when, filedMonthly } from '../utils/periods.js';

/** The annual plan a woreda has accepted for a format + year — what its reports are filed against. */
async function acceptedPlan(woreda_id, format_id, year) {
  const [plan] = await Plan.list({ format_id, woredaIds: [woreda_id], year, status: 'approved', annual: true });
  if (!plan) {
    throw ApiError.conflict('This woreda has no accepted annual plan for this report format and year. '
      + 'The Woreda Department Head must accept the cascaded plan before a report can be filed.');
  }
  return plan;
}

async function planFor(woreda_id, format_id, year, month) {
  const annual = await acceptedPlan(woreda_id, format_id, year);
  if (!month) return annual;
  const plans = await Plan.list({ format_id, woredaIds: [woreda_id], year, monthly: true });
  const plan = plans.find((p) => p.month === month && ['submitted', 'approved'].includes(p.status));
  if (!plan) {
    throw ApiError.conflict(`This woreda has no monthly plan for ${MONTH_NAMES[month]} ${year} yet. `
      + 'The Zonal Expert must cascade the monthly plan before that month can be reported.');
  }
  return plan;
}

/**
 * Report entries follow the plan: only items the woreda's accepted plan has a target for can be reported,
 * and each value must be a number (never negative; a percentage 0–100). Blank = not reported yet.
 * Formats saved in the older section/KPI layout keep their entries as they are.
 */
function cleanEntries(format, plan, raw) {
  const schema = format.schema_definition;
  if (!Array.isArray(schema?.nodes)) return raw ?? {};
  const indicators = new Map(indicatorsOf(schema).map((i) => [i.key, i]));
  const data = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (value === null || value === '' || value === undefined) continue;
    const item = indicators.get(key);
    if (!item) throw ApiError.badRequest(`"${key}" is not an item with a measurement in this report format`);
    if (plan.data?.[key] === undefined) throw ApiError.badRequest(`${item.label} is not in your woreda's plan, so it can't be reported`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw ApiError.badRequest(`${item.label} must be a number`);
    if (value < 0) throw ApiError.badRequest(`${item.label} cannot be negative`);
    if (item.max != null && value > item.max) throw ApiError.badRequest(`${item.label} cannot exceed ${item.max}`);
    data[key] = value;
  }
  return data;
}

/**
 * A monthly report can only be created, edited and submitted while the zone has its month open — between the
 * opening time and the deadline the zone expert / team leader set. The admin is not held to the clock.
 */
async function assertWindowOpen(user, { format_id, zone_id, year, month }) {
  if (user.role === ROLES.ADMIN) return;
  const label = `${MONTH_NAMES[month]} ${year}`;
  const w = await ReportWindow.find({ format_id, zone_id, year, month });
  if (!w) throw ApiError.conflict(`${label} has not been opened for reporting yet. The zonal plan expert must open it first.`);
  const now = Date.now();
  if (now < new Date(w.opens_at).getTime()) throw ApiError.conflict(`Reporting for ${label} opens on ${when(w.opens_at)}.`);
  if (now > new Date(w.closes_at).getTime()) throw ApiError.conflict(`Reporting for ${label} closed on ${when(w.closes_at)}. Ask the zone to extend the deadline.`);
}

async function loadAccessible(req) {
  const report = await Report.findById(req.params.id);
  if (!report) throw ApiError.notFound('Report not found');
  if (!(await canAccessWoreda(req.user, report.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  // a woreda's unsubmitted draft is its own working copy — zonal users can't see it
  if (ZONAL_ROLES.includes(req.user.role) && report.status === STATUS.DRAFT) throw ApiError.notFound('Report not found');
  return report;
}

const assertTransition = (from, to) => {
  if (!TRANSITIONS[from]?.includes(to)) throw ApiError.badRequest(`Cannot move report from "${from}" to "${to}"`);
};

export const listReports = catchAsync(async (req, res) => {
  const { status, type, year, team_id, woreda_id, limit, offset } = req.query;
  const f = { status, type, year: year && Number(year), team_id: team_id && Number(team_id), limit: Number(limit) || 50, offset: Number(offset) || 0 };
  const u = req.user;
  if (WOREDA_ROLES.includes(u.role)) {
    f.woredaIds = [u.woreda_id];
    if (u.role === ROLES.WOREDA_TEAM_LEADER && u.team_id) f.team_id = u.team_id;
    if (u.role === ROLES.WOREDA_EXPERT) f.created_by = u.id;
  } else if (ZONAL_ROLES.includes(u.role)) {
    if (!u.zone_id) return success(res, []);
    f.zone_id = u.zone_id;
    f.excludeDraft = true; // zonal users only see what a woreda has actually submitted
    if (woreda_id) f.woredaIds = [woreda_id];
  } else if (woreda_id) {
    f.woredaIds = [woreda_id];
  }
  success(res, await Report.list(f));
});

export const getReport = catchAsync(async (req, res) => success(res, await loadAccessible(req)));

export const createReport = catchAsync(async (req, res) => {
  const u = req.user;
  const woreda_id = WOREDA_ROLES.includes(u.role) ? u.woreda_id : req.body.woreda_id;
  if (!woreda_id) throw ApiError.badRequest('woreda_id is required');
  if (!(await canAccessWoreda(u, woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  // Reports are filed against an APPROVED report format; its template supplies the team and period type.
  const format = await ReportFormat.findById(req.body.format_id);
  if (!format) throw ApiError.badRequest('Report format not found');
  if (format.status !== 'approved') throw ApiError.badRequest('Reports can only be created against an approved report format');
  if (!format.template_active) throw ApiError.badRequest('The report template behind this format is inactive');
  // …and only for a team/department the user belongs to, and only against a plan the woreda has accepted.
  if (WOREDA_ROLES.includes(u.role) && !inScope(woredaPlanScope(u), format)) throw ApiError.forbidden(OUT_OF_SCOPE);
  const monthly = filedMonthly(format.template_type); // an annual format is reported month by month
  if (monthly) {
    if (!req.body.month) throw ApiError.badRequest('month is required for a monthly report');
    const woreda = await Zone.findWoreda(woreda_id);
    await assertWindowOpen(u, { format_id: format.id, zone_id: woreda.zone_id, year: req.body.year, month: req.body.month });
    if ((await Report.findPeriod({ format_id: format.id, year: req.body.year, month: req.body.month, woreda_id })).length) {
      throw ApiError.conflict(`${woreda.name} already has a report for ${MONTH_NAMES[req.body.month]} ${req.body.year}. Open it from the report list.`);
    }
  }
  const plan = await planFor(woreda_id, format.id, req.body.year, monthly ? req.body.month : null);
  const data = cleanEntries(format, plan, req.body.data);
  const report = await Report.create({ ...req.body, data, type: monthly ? 'monthly' : format.template_type, woreda_id, team_id: format.team_id }, u.id);
  res.locals.auditTargetId = report.id;
  created(res, report, 'Draft created');
});

export const updateReport = catchAsync(async (req, res) => {
  const report = await loadAccessible(req);
  if (![STATUS.DRAFT, STATUS.REJECTED].includes(report.status)) throw ApiError.badRequest('Only draft or rejected reports can be edited');
  if (report.created_by !== req.user.id && req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.WOREDA_DEPT_HEAD) {
    throw ApiError.forbidden('Only the author can edit this report');
  }
  if (report.type === 'monthly' && report.format_id && report.month) await assertWindowOpen(req.user, report);
  let data = req.body.data;
  if (report.format_id) { // reports filed against a format follow its accepted plan
    const format = await ReportFormat.findById(report.format_id);
    data = cleanEntries(format, await planFor(report.woreda_id, report.format_id, report.year, report.month), data);
  }
  let result = await Report.updateData(report.id, { ...req.body, data });
  // editing a rejected report returns it to draft so it can be resubmitted
  if (report.status === STATUS.REJECTED) result = await Report.setStatus(report.id, STATUS.DRAFT);
  success(res, result, 'Report saved');
});

export const submitReport = catchAsync(async (req, res) => {
  const report = await loadAccessible(req);
  assertTransition(report.status, STATUS.SUBMITTED);
  if (report.type === 'monthly' && report.format_id && report.month) await assertWindowOpen(req.user, report);
  const updated = await Report.setStatus(report.id, STATUS.SUBMITTED);
  // notify zonal reviewers of the woreda's zone
  const reviewers = await User.list({ zone_id: report.zone_id, limit: 200 });
  await Promise.all(reviewers.filter((r) => REVIEWER_ROLES.includes(r.role)).map((r) =>
    notify(r.id, `New report submitted: ${report.title}`, { report_id: report.id })));
  success(res, updated, 'Report submitted');
});

export const reviewReport = catchAsync(async (req, res) => {
  const { action, feedback } = req.body;
  const report = await loadAccessible(req);
  const next = { start_review: STATUS.REVIEWING, approve: STATUS.APPROVED, reject: STATUS.REJECTED }[action];
  assertTransition(report.status, next);
  if (next === STATUS.REJECTED && !feedback) throw ApiError.badRequest('Feedback is required when rejecting');
  const updated = await Report.setStatus(report.id, next, { reviewerId: req.user.id, feedback });
  if (next !== STATUS.REVIEWING) await notify(report.created_by, `Your report "${report.title}" was ${next}`, { report_id: report.id });
  success(res, updated, `Report ${next}`);
});

export const deleteReport = catchAsync(async (req, res) => {
  const report = await loadAccessible(req);
  if (report.status !== STATUS.DRAFT) throw ApiError.badRequest('Only drafts can be deleted');
  await Report.remove(report.id);
  success(res, null, 'Report deleted');
});

export const getPlan = catchAsync(async (req, res) => {
  const plan = await Report.getPlanWithValues(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  if (!(await canAccessWoreda(req.user, plan.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  success(res, plan);
});

/**
 * Zone level users and the system admin: every woreda's report for one format and period on a single sheet —
 * per woreda the target (plan) and what was reported, so the two can be read side by side.
 *   GET /reports/sheet?format_id=&year=&month=|quarter=|range=&zone_id=
 * `range` = q1 q2 q3 q4 | h1 h2 | annual (monthly formats): the monthly reports of those months summed up — counts
 * added, percentages averaged — against the monthly plans of the same months (the annual plan for `annual` when
 * no monthly plan was cascaded). Zonal users get their own zone (and only formats of their department / team); the
 * admin gets every woreda, or one zone when zone_id is given. For a single month the target is the woreda's
 * accepted annual plan, or that month's cascaded monthly plan when there is one. Drafts are never included.
 */
export const reportSheet = catchAsync(async (req, res) => {
  const u = req.user;
  const format_id = Number(req.query.format_id);
  const year = Number(req.query.year);
  if (!format_id || !year) throw ApiError.badRequest('format_id and year are required');
  const format = await ReportFormat.findById(format_id);
  if (!format) throw ApiError.notFound('Report format not found');
  if (!inScope(templateScope(u), format)) throw ApiError.forbidden(OUT_OF_SCOPE);

  const type = filedMonthly(format.template_type) ? 'monthly' : format.template_type; // an annual format is reported monthly
  const range = req.query.range ? RANGES[req.query.range] : null;
  if (req.query.range && !range) throw ApiError.badRequest('range must be q1, q2, q3, q4, h1, h2 or annual');
  if (range && type !== 'monthly') throw ApiError.badRequest('Quarter, half-year and annual summaries are built from monthly reports');
  const month = type === 'monthly' ? Number(req.query.month) : null;
  const quarter = type === 'quarterly' ? Number(req.query.quarter) : null;
  if (type === 'monthly' && !range && !(month >= 1 && month <= 12)) throw ApiError.badRequest('month (1–12) is required for a monthly report format');
  if (type === 'quarterly' && !(quarter >= 1 && quarter <= 4)) throw ApiError.badRequest('quarter (1–4) is required for a quarterly report format');

  let zone_id;
  if (ZONAL_ROLES.includes(u.role)) {
    if (!u.zone_id) return success(res, { format, year, month, quarter, woredas: [] });
    zone_id = u.zone_id;
  } else zone_id = req.query.zone_id || undefined;
  const woredas = await Zone.listWoredas(zone_id);
  const woredaIds = woredas.map((w) => w.woreda_id);

  const [annual, monthly, reports] = await Promise.all([
    Plan.list({ format_id, woredaIds, year, status: 'approved', annual: true }),
    type === 'monthly' ? Plan.list({ format_id, woredaIds, year, monthly: true }) : [],
    range ? Report.sheetMonths({ format_id, year, months: range.months, woredaIds }) : Report.sheet({ format_id, year, type, month, quarter, woredaIds }),
  ]);

  if (range) { // summary of several months
    const indicators = indicatorsOf(format.schema_definition);
    return success(res, {
      format, year, range: req.query.range, rangeLabel: range.label, months: range.months,
      woredas: woredas.map((w) => {
        const counted = reports.filter((r) => r.woreda_id === w.woreda_id && COUNTED.includes(r.status));
        const plans = monthly.filter((p) => p.woreda_id === w.woreda_id && range.months.includes(p.month) && ['submitted', 'approved'].includes(p.status));
        const a = annual.find((p) => p.woreda_id === w.woreda_id);
        const plan = plans.length ? { kind: 'monthly', data: summarise(indicators, plans), months: plans.length }
          : req.query.range === 'annual' && a ? { kind: 'annual', data: a.data } : null;
        return {
          woreda_id: w.woreda_id, name: w.name, zone_id: w.zone_id, plan,
          report: counted.length ? { id: null, status: 'summary', data: summarise(indicators, counted), submitted_at: null } : null,
          months: { reported: counted.length, expected: range.months.length },
        };
      }),
    });
  }

  success(res, {
    format, year, month, quarter,
    woredas: woredas.map((w) => {
      const a = annual.find((p) => p.woreda_id === w.woreda_id);
      const m = monthly.find((p) => p.woreda_id === w.woreda_id && p.month === month && ['submitted', 'approved'].includes(p.status));
      const r = reports.find((x) => x.woreda_id === w.woreda_id);
      return {
        woreda_id: w.woreda_id, name: w.name, zone_id: w.zone_id,
        plan: m ? { kind: 'monthly', data: m.data } : a ? { kind: 'annual', data: a.data } : null,
        report: r ? { id: r.id, status: r.status, data: r.data || {}, submitted_at: r.submitted_at } : null,
      };
    }),
  });
});
