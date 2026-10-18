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

  const opened = [];
  for (const format of formats) {
    const w = await openOne(format, { zone_id, year, month, opens, closes, userId: u.id });
    if (w) opened.push(w);
  }
  if (!opened.length) throw ApiError.conflict(`${MONTH_NAMES[month]} ${year} is already open for ${formats.length > 1 ? 'all these report formats' : 'this report'}. Change its dates instead.`);
  res.locals.auditTargetId = opened[0].id;
  created(res, { count: opened.length, windows: opened },
    `${MONTH_NAMES[month]} ${year} opened for reporting — ${opened.length} report format${opened.length > 1 ? 's' : ''}`);
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
