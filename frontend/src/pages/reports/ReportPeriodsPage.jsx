import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Loader from '../../components/common/Loader.jsx';
import ReportTabs from '../../components/reports/ReportTabs.jsx';
import ReportStatusBadge from '../../components/reports/ReportStatusBadge.jsx';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportWindowService from '../../services/reportWindowService.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { MONTH_OPTIONS, monthName, fmtDateTime, toLocalInput, fromLocalInput, timeLeft, currentFiscalYear, filedMonthly } from '../../utils/periods.js';
import EcDateTimeInput from '../../components/common/EcDateTimeInput.jsx';

const STATE_TONE = { upcoming: 'gray', open: 'green', closed: 'red' };
const WOREDA_STATE = { submitted: ['green', 'submitted'], in_progress: ['amber', 'in progress'], not_started: ['gray', 'not started'], no_plan: ['gray', 'no accepted plan'] };

/**
 * Reporting periods. The Zonal Plan Expert opens a month for the woredas of their zone with an opening time and a
 * deadline; woredas can create, edit and submit that month's reports only inside those times. A month is ONE period
 * for the zone, however many teams' reports it covers. A woreda counts as submitted once its Woreda Plan Expert has
 * approved every team report it owes; "Show woredas" lists where each woreda and each team stands. Other zone roles can read.
 */
export default function ReportPeriodsPage() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const isAdmin = user.role === ROLES.ADMIN;
  const canOpen = isAdmin || user.role === ROLES.ZONAL_PLAN_EXPERT;
  const [zoneId, setZoneId] = useState('');

  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: formats } = useFetch(() => reportFormatService.list({ status: 'approved' }), []);
  const { data: periods, loading, reload } = useFetch(() => reportWindowService.periods(isAdmin && zoneId ? { zone_id: zoneId } : {}), [zoneId]);
  const annual = (formats || []).filter((f) => filedMonthly(f.template_type)); // monthly and annual templates are both reported month by month

  const now = new Date();
  const [form, setForm] = useState({ format_id: '', year: String(currentFiscalYear()), month: '', opens_at: toLocalInput(now), closes_at: toLocalInput(new Date(now.getTime() + 7 * 86400000)), zone_id: '' });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);       // key of the period whose woredas are shown
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);       // { key, opens_at, closes_at }

  const chooseFormat = (id) => {
    const f = annual.find((x) => String(x.id) === String(id));
    setForm((cur) => ({ ...cur, format_id: id, ...(f ? { year: String(f.version_year) } : {}) }));
  };

  const openPeriod = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await reportWindowService.create({
        ...(form.format_id ? { format_id: Number(form.format_id) } : {}), year: Number(form.year), month: Number(form.month),
        opens_at: fromLocalInput(form.opens_at), closes_at: fromLocalInput(form.closes_at), ...(isAdmin ? { zone_id: form.zone_id } : {}),
      });
      success(`${monthName(form.month)} ${form.year} is open — the woredas have been notified`);
      setForm((cur) => ({ ...cur, month: '' }));
      reload();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  const show = async (p) => {
    const key = reportWindowService.periodKey(p);
    if (open === key) { setOpen(null); return; }
    try { setDetail(await reportWindowService.period(p)); setOpen(key); } catch (err) { error(errorMessage(err)); }
  };
  const run = async (fn, msg) => { try { await fn(); success(msg); setEdit(null); setOpen(null); reload(); } catch (err) { error(errorMessage(err)); } };
  const saveDates = (p) => run(() => reportWindowService.updatePeriod(p, { opens_at: fromLocalInput(edit.opens_at), closes_at: fromLocalInput(edit.closes_at) }), 'Dates updated');
  const closeNow = (p) => window.confirm(`Close ${monthName(p.month)} ${p.year} now? Woredas that haven't submitted won't be able to.`)
    && run(() => reportWindowService.updatePeriod(p, { closes_at: new Date().toISOString() }), 'Reporting period closed');
  const remove = (p) => window.confirm(`Remove ${monthName(p.month)} ${p.year}?`) && run(() => reportWindowService.removePeriod(p), 'Reporting period removed');

  if (!ref || loading) return <Loader />;

  return (
    <>
      <Header title="Reporting periods" subtitle="Open a month for the woredas to report in, with a deadline." />
      <ReportTabs />

      {canOpen && (
        <Card title="Open a reporting period" className="mb-6">
          {!annual.length ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">There is no approved <em>monthly</em> report format yet. Quarterly, half-year and annual reports are summed up from the monthly ones, so a monthly format has to be approved first.</p>
          ) : (
            <form onSubmit={openPeriod} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="label" htmlFor="rp-format">Report format</label>
                  <select id="rp-format" className="input" value={form.format_id} onChange={(e) => chooseFormat(e.target.value)}>
                    <option value="">All teams' monthly formats</option>
                    {annual.map((f) => <option key={f.id} value={f.id}>{f.template_title} — {f.version_name} · {f.team_name} (v{f.version})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="rp-year">Year</label>
                  <input id="rp-year" type="number" required className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="rp-month">Month</label>
                  <select id="rp-month" required className="input" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
                    <option value="">Select…</option>
                    {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="rp-opens">Opens</label>
                  <EcDateTimeInput id="rp-opens" required value={form.opens_at} onChange={(v) => setForm({ ...form, opens_at: v })} />
                </div>
                <div>
                  <label className="label" htmlFor="rp-closes">Deadline</label>
                  <EcDateTimeInput id="rp-closes" required value={form.closes_at} onChange={(v) => setForm({ ...form, closes_at: v })} />
                </div>
                {isAdmin && (
                  <div>
                    <label className="label" htmlFor="rp-zone">Zone</label>
                    <select id="rp-zone" required className="input" value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
                      <option value="">Select…</option>
                      {ref.zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={busy}>Open for woredas</Button>
                <span className="text-xs text-slate-500 dark:text-slate-400">Every woreda of the zone is notified. They can create, edit and submit this month's report only between these two times; you can extend the deadline later.</span>
              </div>
            </form>
          )}
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Periods</h2>
        {isAdmin && (
          <select aria-label="Zone" className="input w-52" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">All zones</option>
            {ref.zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
          </select>
        )}
      </div>

      {!periods?.length ? (
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">No reporting period has been opened yet.</p></Card>
      ) : (
        <div className="space-y-4">
          {periods.map((p) => {
            const key = reportWindowService.periodKey(p);
            const pct = p.woreda_count ? Math.round((p.submitted_count / p.woreda_count) * 100) : 0;
            const editing = edit?.key === key;
            return (
              <Card key={key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {monthName(p.month)} {p.year}
                      <Badge tone={STATE_TONE[p.state]}>{p.state}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {p.zone_name} · opens {fmtDateTime(p.opens_at)} · deadline {fmtDateTime(p.closes_at)}{p.state === 'open' ? ` · ${timeLeft(p.closes_at)}` : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.teams.map((t) => <Badge key={t.window_id} tone="gray">{t.team_name || t.template_title}</Badge>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => show(p)}>{open === key ? 'Hide woredas' : 'Show woredas'}</Button>
                    {canOpen && !editing && <Button variant="secondary" onClick={() => setEdit({ key, opens_at: toLocalInput(p.opens_at), closes_at: toLocalInput(p.closes_at) })}>Change dates</Button>}
                    {canOpen && p.state === 'open' && <Button variant="secondary" onClick={() => closeNow(p)}>Close now</Button>}
                    {canOpen && p.submitted_count === 0 && <Button variant="secondary" onClick={() => remove(p)}>Remove</Button>}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{p.submitted_count} of {p.woreda_count} woredas have submitted</span><span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {editing && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
                    <div><label className="label">Opens</label><EcDateTimeInput value={edit.opens_at} onChange={(v) => setEdit({ ...edit, opens_at: v })} /></div>
                    <div><label className="label">Deadline</label><EcDateTimeInput value={edit.closes_at} onChange={(v) => setEdit({ ...edit, closes_at: v })} /></div>
                    <Button onClick={() => saveDates(p)}>Save</Button>
                    <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Applies to every team's report of this month.</span>
                  </div>
                )}

                {open === key && detail && reportWindowService.periodKey(detail) === key && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                        <tr><th className="px-3 py-2 font-medium">Woreda</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Team reports</th><th className="px-3 py-2 font-medium">Submitted</th><th className="px-3 py-2 font-medium">Timing</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {detail.woredas.map((x) => {
                          const [tone, label] = WOREDA_STATE[x.state] || WOREDA_STATE.not_started;
                          const submitted = x.state === 'submitted';
                          const late = submitted && x.submitted_at && new Date(x.submitted_at) > new Date(p.closes_at);
                          return (
                            <tr key={x.woreda_id}>
                              <td className="px-3 py-2 font-medium">{x.name}</td>
                              <td className="px-3 py-2">
                                <Badge tone={tone}>{label}</Badge>
                                {x.state === 'in_progress' && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{x.approved} of {x.expected} team reports approved by the woreda plan expert</div>}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  {x.teams.map((t) => {
                                    const atZone = ['submitted', 'reviewing', 'approved'].includes(t.status);
                                    const name = t.team_name || t.template_title;
                                    return (
                                      <div key={t.format_id} className="flex items-center gap-2 text-xs">
                                        {atZone && t.report_id ? <Link className="font-medium hover:underline" to={`/reports/${t.report_id}`}>{name}</Link> : <span className="font-medium">{name}</span>}
                                        {t.status ? <ReportStatusBadge status={t.status} /> : <span className="text-slate-400">not started</span>}
                                      </div>
                                    );
                                  })}
                                  {!x.teams.length && <span className="text-xs text-slate-400">—</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs">{submitted ? fmtDateTime(x.submitted_at) : '—'}</td>
                              <td className="px-3 py-2 text-xs">
                                {submitted ? (late ? <span className="text-red-600 dark:text-red-400">late</span> : <span className="text-emerald-600 dark:text-emerald-400">on time</span>)
                                  : x.state === 'no_plan' ? <span className="text-slate-400">—</span>
                                    : p.state === 'closed' ? <span className="text-red-600 dark:text-red-400">missed the deadline</span>
                                      : p.state === 'upcoming' ? <span className="text-slate-400">not open yet</span> : <span className="text-amber-600 dark:text-amber-400">waiting</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
