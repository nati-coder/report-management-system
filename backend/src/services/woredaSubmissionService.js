import ReportWindow from '../models/ReportWindow.js';
import Report from '../models/Report.js';
import Plan from '../models/Plan.js';
import Zone from '../models/Zone.js';
import User from '../models/User.js';
import { WITH_ZONE } from '../constants/status.js';
import { REVIEWER_ROLES, ROLES } from '../constants/roles.js';
import { notifyMany } from './notificationService.js';
import { withAdvisoryLock } from '../../config/db.js';
import { MONTH_NAMES } from '../utils/periods.js';

const READY = ['woreda_approved', ...WITH_ZONE];

/**
 * Where every woreda of a zone stands in ONE reporting period (a zone, a department, a month).
 * `windows` = the report_windows of that period, one per team's format.
 *
 * A woreda is expected to report the formats of the period it has an accepted annual plan for. It has SUBMITTED
 * once every one of those team reports has reached the zone — which happens when its Woreda Plan Expert has
 * approved them all. Returns, per woreda:
 *   { woreda_id, name, state: 'submitted'|'in_progress'|'not_started'|'no_plan',
 *     approved: n, expected: n, submitted_at, teams: [{ format_id, team_id, team_name, template_title, report_id, status }] }
 */
export async function periodProgress(windows) {
  const { zone_id, year, month } = windows[0];
  const formatIds = windows.map((w) => w.format_id);
  const [woredas, plans, reports] = await Promise.all([
    Zone.listWoredas(zone_id),
    Plan.list({ zone_id, year, status: 'approved', annual: true }),
    Report.forPeriod({ format_ids: formatIds, year, month, zone_id }),
  ]);
  const planned = new Set(plans.filter((p) => formatIds.includes(p.format_id)).map((p) => `${p.woreda_id}|${p.format_id}`));
  const byKey = new Map(reports.map((r) => [`${r.woreda_id}|${r.format_id}`, r]));

  return woredas.map((w) => {
    const teams = windows.filter((win) => planned.has(`${w.woreda_id}|${win.format_id}`)).map((win) => {
      const r = byKey.get(`${w.woreda_id}|${win.format_id}`);
      return { format_id: win.format_id, team_id: win.team_id, team_name: win.team_name, template_title: win.template_title, report_id: r?.id ?? null, status: r?.status ?? null, submitted_at: r?.submitted_at ?? null };
    });
    const approved = teams.filter((t) => t.status && READY.includes(t.status)).length;
    const sent = teams.filter((t) => t.status && WITH_ZONE.includes(t.status));
    let state = 'not_started';
    if (!teams.length) state = 'no_plan';
    else if (sent.length === teams.length) state = 'submitted';
    else if (teams.some((t) => t.status)) state = 'in_progress';
    const submitted_at = state === 'submitted' ? sent.map((t) => t.submitted_at).filter(Boolean).sort().pop() ?? null : null;
    return { woreda_id: w.woreda_id, name: w.name, state, approved, expected: teams.length, submitted_at, teams };
  });
}

/** All report_windows of one zone / department / month. */
export async function windowsOfPeriod({ zone_id, department_id, year, month }) {
  return (await ReportWindow.list({ zone_id, year, department_id })).filter((w) => w.month === Number(month));
}

/**
 * Run `fn` while no other request is approving a report of the same woreda and month. Without it two plan-expert
 * approvals landing together can each see the other team's report as not yet approved, so neither forwards the
 * woreda and its reports stay stuck inside it.
 */
export const withPeriodLock = (report, fn) =>
  withAdvisoryLock(`woreda-period:${report.woreda_id}:${report.year}:${report.month}`, fn);

/**
 * Called after the Woreda Plan Expert approves a team report: when every team report the woreda owes for that
 * period is approved, they all move to 'submitted' together — the woreda has submitted — and the zone is told.
 */
export async function forwardIfComplete(report, format) {
  const woreda = await Zone.findWoreda(report.woreda_id);
  const windows = await windowsOfPeriod({ zone_id: woreda.zone_id, department_id: format.department_id, year: report.year, month: report.month });
  if (!windows.length) return { forwarded: false, waiting: 0 };
  const mine = (await periodProgress(windows)).find((x) => x.woreda_id === report.woreda_id);
  if (!mine?.teams.length) return { forwarded: false, waiting: 0 };
  const waiting = mine.teams.filter((t) => !t.status || !READY.includes(t.status));
  if (waiting.length) return { forwarded: false, waiting: waiting.length, waitingTeams: waiting.map((t) => t.team_name || t.template_title) };
  const ids = mine.teams.filter((t) => t.status === 'woreda_approved').map((t) => t.report_id);
  if (!ids.length) return { forwarded: false, waiting: 0 };
  await Report.forward(ids);
  // filter by role in SQL: a plain "latest 200 users of the zone" list can miss the reviewers entirely in a big zone
  const staff = await User.list({ zone_id: woreda.zone_id, roles: REVIEWER_ROLES.filter((r) => r !== ROLES.ADMIN), activeOnly: true, limit: 1000 });
  await notifyMany(
    staff.filter((u) => !u.department_id || u.department_id === format.department_id).map((u) => u.id),
    `${woreda.name} has submitted its ${MONTH_NAMES[report.month]} ${report.year} reports (${mine.teams.length} team${mine.teams.length > 1 ? 's' : ''}).`,
    { woreda_id: report.woreda_id, year: report.year, month: report.month });
  return { forwarded: true, count: ids.length };
}
