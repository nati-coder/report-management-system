import ReportWindow from '../models/ReportWindow.js';
import ReportFormat from '../models/ReportFormat.js';
import Report from '../models/Report.js';
import Zone from '../models/Zone.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import { success, created, ApiError } from '../utils/apiResponse.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES } from '../constants/roles.js';
import { notifyMany } from '../services/notificationService.js';
import { templateScope, woredaPlanScope, inScope, OUT_OF_SCOPE } from '../utils/scope.js';
import { MONTH_NAMES, when } from '../utils/periods.js';
import { periodProgress, windowsOfPeriod } from '../services/woredaSubmissionService.js';

const num = (v) => (v ? Number(v) : undefined);

/** The zone of a user and the department / team scope their account confines them to. */
async function viewerScope(u) {
  if (WOREDA_ROLES.includes(u.role)) {
    const scope = woredaPlanScope(u);
    const woreda = u.woreda_id ? await Zone.findWoreda(u.woreda_id) : null;
    return { zone_id: woreda?.zone_id, scope };
  }
  return { zone_id: ZONAL_ROLES.includes(u.role) ? u.zone_id : undefined, scope: templateScope(u) };
}

/** Anything the viewer may open: their own zone, and only formats of their department / team. */
async function loadAccessible(req) {
  const w = await ReportWindow.findById(req.params.id);
  if (!w) throw ApiError.notFound('Reporting period not found');
  const { zone_id, scope } = await viewerScope(req.user);
  if (req.user.role !== ROLES.ADMIN && w.zone_id !== zone_id) throw ApiError.forbidden('Outside your administrative scope');
  if (!inScope(scope, w)) throw ApiError.forbidden(OUT_OF_SCOPE);
  return w;
}

const parseWhen = (v, what) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`${what} is not a valid date and time`);
  return d;
};

/** Woreda users of a zone who report this format: its department, and its team when it has one. */
async function recipientsOf(zone_id, format) {
  const ids = [];
  for (const w of await Zone.listWoredas(zone_id)) {
    const users = await User.list({ woreda_id: w.woreda_id, department_id: format.department_id, limit: 200 });
    ids.push(...users.filter((x) => WOREDA_ROLES.includes(x.role) && (!format.team_id || !x.team_id || x.team_id === format.team_id)).map((x) => x.id));
  }
  return ids;
}

/**
 * Reporting periods. Zonal users get their zone's, woreda users the ones for their woreda's zone, the admin all
 * (or one zone). ?open=true = only the periods open right now.
 */
export const listWindows = catchAsync(async (req, res) => {
  const { format_id, year, open, zone_id } = req.query;
  const { zone_id: myZone, scope } = await viewerScope(req.user);
  if (!scope) return success(res, []);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isAdmin && !myZone) return success(res, []);
  success(res, await ReportWindow.list({
    zone_id: isAdmin ? zone_id : myZone, format_id: num(format_id), year: num(year), open: open === 'true' || open === '1',
    department_id: scope.department_id, team_id: scope.team_id,
  }));
});

/** One period with every woreda of the zone and the status of its report — who has submitted and who hasn't. */
export const getWindow = catchAsync(async (req, res) => {
  const w = await loadAccessible(req);
  success(res, { ...w, woredas: await ReportWindow.progress(w) });
});

/** Zonal Plan Expert: open a month of a monthly report format for the woredas of their zone. */
/** Open one format for a zone and month and tell the woreda users who report it. Returns null when it is already open. */
async function openOne(format, { zone_id, year, month, opens, closes, userId }) {
  if (await ReportWindow.find({ format_id: format.id, zone_id, year, month })) return null;
  const w = await ReportWindow.create({ format_id: format.id, zone_id, year, month, opens_at: opens, closes_at: closes }, userId);
  await notifyMany(await recipientsOf(zone_id, format),
    `Reporting is open: ${format.template_title} — ${MONTH_NAMES[month]} ${year}. Submit between ${when(opens)} and ${when(closes)}.`, { window_id: w.id, format_id: format.id });
  return w;
}

export const createWindow = catchAsync(async (req, res) => {
  const u = req.user;
  const { format_id, year, month } = req.body;
  const scope = templateScope(u);
  if (!scope) throw ApiError.forbidden(OUT_OF_SCOPE);

  let formats;
  if (format_id) {
    const format = await ReportFormat.findById(format_id);
    if (!format) throw ApiError.badRequest('Report format not found');
    if (format.status !== 'approved') throw ApiError.badRequest('A reporting period can only be opened for an approved report format');
    if (!format.template_active) throw ApiError.badRequest('The report template behind this format is inactive');
    if (format.template_type !== 'annual') throw ApiError.badRequest('A reporting period is opened from an annual report format; the woredas then report that month against their monthly plan');
    if (!inScope(scope, format)) throw ApiError.forbidden(OUT_OF_SCOPE);
    formats = [format];
  } else {
    const latest = new Map(); // the latest approved revision of each active annual template, of every team in the department
    for (const f of await ReportFormat.list({ status: 'approved', department_id: scope.department_id, team_id: scope.team_id })) {
      if (f.template_type !== 'annual' || !f.template_active) continue;
      if (!latest.has(f.template_id) || f.version > latest.get(f.template_id).version) latest.set(f.template_id, f);
    }
    formats = [...latest.values()];
    if (!formats.length) throw ApiError.badRequest('There is no approved annual report format in your department to open');
  }

  const zone_id = u.role === ROLES.ADMIN ? req.body.zone_id : u.zone_id;
  if (!zone_id) throw ApiError.badRequest(u.role === ROLES.ADMIN ? 'zone_id is required' : 'Your account has no zone');
  if (!(await Zone.findZone(zone_id))) throw ApiError.badRequest('Unknown zone');

  const opens = parseWhen(req.body.opens_at, 'The opening time');
  const closes = parseWhen(req.body.closes_at, 'The deadline');
  if (closes <= opens) throw ApiError.badRequest('The deadline must be after the opening time');
  if (closes <= new Date()) throw ApiError.badRequest('The deadline is already in the past');

  // A month is ONE period for the zone: a format added to a month that is already open (a team whose format was
  // approved later) joins it and takes its dates, so the zone never ends up with two deadlines for the same month.
  const existing = (await ReportWindow.list({ zone_id, year })).filter((x) => x.month === month);
  const opened = []; let joined = 0;
  for (const format of formats) {
    const same = existing.find((x) => x.department_id === format.department_id);
    if (same) joined++;
    const w = await openOne(format, { zone_id, year, month, opens: same ? new Date(same.opens_at) : opens, closes: same ? new Date(same.closes_at) : closes, userId: u.id });
    if (w) opened.push(w);
  }
  if (!opened.length) throw ApiError.conflict(`${MONTH_NAMES[month]} ${year} is already open for ${formats.length > 1 ? 'all these report formats' : 'this report'}. Change its dates instead.`);
  res.locals.auditTargetId = opened[0].id;
  created(res, { count: opened.length, windows: opened },
    `${MONTH_NAMES[month]} ${year} opened for reporting — ${opened.length} report format${opened.length > 1 ? 's' : ''}${joined && opened.length ? ' (added to the period that is already open, with its dates)' : ''}`);
});

/** Change the dates of a period — extend the deadline, or close it now. */
export const updateWindow = catchAsync(async (req, res) => {
  const w = await loadAccessible(req);
  const opens = req.body.opens_at ? parseWhen(req.body.opens_at, 'The opening time') : new Date(w.opens_at);
  const closes = req.body.closes_at ? parseWhen(req.body.closes_at, 'The deadline') : new Date(w.closes_at);
  if (closes <= opens) throw ApiError.badRequest('The deadline must be after the opening time');
  const result = await ReportWindow.update(w.id, { opens_at: req.body.opens_at ? opens : null, closes_at: req.body.closes_at ? closes : null });
  if (closes > new Date(w.closes_at)) {
    const format = await ReportFormat.findById(w.format_id);
    await notifyMany(await recipientsOf(w.zone_id, format),
      `Deadline extended: ${format.template_title} — ${MONTH_NAMES[w.month]} ${w.year} can now be submitted until ${when(closes)}.`, { window_id: w.id, format_id: w.format_id });
  }
  success(res, result, 'Reporting period updated');
});

/** Remove a period nobody has reported in (a mistake); once there are reports it can only be closed. */
export const deleteWindow = catchAsync(async (req, res) => {
  const w = await loadAccessible(req);
  const reports = await Report.findPeriod({ format_id: w.format_id, year: w.year, month: w.month, zone_id: w.zone_id });
  if (reports.length) throw ApiError.conflict('Woredas have already started reports in this period, so it can only be closed, not removed');
  await ReportWindow.remove(w.id);
  success(res, null, 'Reporting period removed');
});

// ---------------------------------------------------------------------------------------------------------------
// Periods — what the zone sees. A report_window is one team's format for one month; a PERIOD is the month itself:
// one entry per zone + department + month, however many teams' formats it covers. A woreda has SUBMITTED to the
// period when its Woreda Plan Expert has approved every team report it owes (see woredaSubmissionService).
// ---------------------------------------------------------------------------------------------------------------

/** The period named in the URL, if the viewer may see it: its windows (every team) and the viewer's team filter. */
async function loadPeriod(req) {
  const { zone_id, department_id, year, month } = req.params;
  const { zone_id: myZone, scope } = await viewerScope(req.user);
  if (!scope) throw ApiError.forbidden(OUT_OF_SCOPE);
  if (req.user.role !== ROLES.ADMIN && zone_id !== myZone) throw ApiError.forbidden('Outside your administrative scope');
  if (!scope.all && Number(department_id) !== scope.department_id) throw ApiError.forbidden(OUT_OF_SCOPE);
  const windows = await windowsOfPeriod({ zone_id, department_id: Number(department_id), year: Number(year), month: Number(month) });
  if (!windows.length) throw ApiError.notFound('Reporting period not found');
  return { windows, scope };
}

/** One period as the zone reads it: the month, its dates and state, the teams opened, and how many woredas have submitted. */
function shapePeriod(windows, progress, scope) {
  const w0 = windows.reduce((a, b) => (new Date(b.closes_at) > new Date(a.closes_at) ? b : a)); // dates are changed together; this is the latest
  const visible = scope.team_id ? windows.filter((w) => w.team_id === scope.team_id) : windows; // a team's expert sees their own team
  return {
    zone_id: w0.zone_id, zone_name: w0.zone_name, department_id: w0.department_id, year: w0.year, month: w0.month,
    opens_at: w0.opens_at, closes_at: w0.closes_at, state: w0.state,
    teams: visible.map((w) => ({ window_id: w.id, format_id: w.format_id, team_id: w.team_id, team_name: w.team_name, template_title: w.template_title })),
    woreda_count: progress.filter((p) => p.state !== 'no_plan').length,
    submitted_count: progress.filter((p) => p.state === 'submitted').length,
  };
}

/** GET /report-windows/periods — the zone's periods, one per month. */
export const listPeriods = catchAsync(async (req, res) => {
  const { year, zone_id } = req.query;
  const { zone_id: myZone, scope } = await viewerScope(req.user);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!scope || (!isAdmin && !myZone)) return success(res, []);
  const rows = await ReportWindow.list({ zone_id: isAdmin ? zone_id : myZone, year: num(year), department_id: scope.department_id });
  const groups = new Map();
  for (const w of rows) {
    const k = [w.zone_id, w.department_id, w.year, w.month].join('|');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(w);
  }
  const periods = await Promise.all([...groups.values()].map(async (windows) => shapePeriod(windows, await periodProgress(windows), scope)));
  success(res, periods.sort((a, b) => new Date(b.closes_at) - new Date(a.closes_at)));
});

/** GET /report-windows/periods/:zone_id/:department_id/:year/:month — the period with every woreda and its team reports. */
export const getPeriod = catchAsync(async (req, res) => {
  const { windows, scope } = await loadPeriod(req);
  const progress = await periodProgress(windows);
  const period = shapePeriod(windows, progress, scope);
  const mine = new Set(period.teams.map((t) => t.format_id));
  success(res, { ...period, woredas: progress.map((p) => ({ ...p, teams: p.teams.filter((t) => mine.has(t.format_id)) })) });
});

/** PUT …/periods/… — move the dates of the whole month (every team's window together). */
export const updatePeriod = catchAsync(async (req, res) => {
  const { windows } = await loadPeriod(req);
  const w0 = windows[0];
  const opens = req.body.opens_at ? parseWhen(req.body.opens_at, 'The opening time') : new Date(w0.opens_at);
  const closes = req.body.closes_at ? parseWhen(req.body.closes_at, 'The deadline') : new Date(w0.closes_at);
  if (closes <= opens) throw ApiError.badRequest('The deadline must be after the opening time');
  const extended = windows.some((w) => closes > new Date(w.closes_at));
  for (const w of windows) await ReportWindow.update(w.id, { opens_at: req.body.opens_at ? opens : null, closes_at: req.body.closes_at ? closes : null });
  if (extended) {
    const ids = [];
    for (const w of windows) ids.push(...await recipientsOf(w.zone_id, await ReportFormat.findById(w.format_id)));
    await notifyMany(ids, `Deadline extended: ${MONTH_NAMES[w0.month]} ${w0.year} can now be submitted until ${when(closes)}.`, { year: w0.year, month: w0.month });
  }
  success(res, null, 'Reporting period updated');
});

/** DELETE …/periods/… — remove a month nobody has reported in. */
export const deletePeriod = catchAsync(async (req, res) => {
  const { windows } = await loadPeriod(req);
  for (const w of windows) {
    if ((await Report.findPeriod({ format_id: w.format_id, year: w.year, month: w.month, zone_id: w.zone_id })).length) {
      throw ApiError.conflict('Woredas have already started reports in this period, so it can only be closed, not removed');
    }
  }
  for (const w of windows) await ReportWindow.remove(w.id);
  success(res, null, 'Reporting period removed');
});
