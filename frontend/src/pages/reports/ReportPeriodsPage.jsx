import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Loader from '../../components/common/Loader.jsx';
import ReportTabs from '../../components/reports/ReportTabs.jsx';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportWindowService from '../../services/reportWindowService.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { MONTH_OPTIONS, monthName, fmtDateTime, toLocalInput, fromLocalInput, timeLeft } from '../../utils/periods.js';

const STATE_TONE = { upcoming: 'gray', open: 'green', closed: 'red' };
const REPORT_TONE = { draft: 'gray', submitted: 'blue', reviewing: 'amber', approved: 'green', rejected: 'red' };

/**
 * Reporting periods. The Zonal Plan Expert opens a month of a monthly report for the woredas of their
 * zone with an opening time and a deadline; woredas can create, edit and submit that month's report only inside
 * those times. Each period shows who has submitted and who hasn't. Other zone roles can read.
 */
export default function ReportPeriodsPage() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const isAdmin = user.role === ROLES.ADMIN;
  const canOpen = isAdmin || user.role === ROLES.ZONAL_PLAN_EXPERT;
  const [zoneId, setZoneId] = useState('');

  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: formats } = useFetch(() => reportFormatService.list({ status: 'approved' }), []);
  const { data: windows, loading, reload } = useFetch(() => reportWindowService.list(isAdmin && zoneId ? { zone_id: zoneId } : {}), [zoneId]);
  const annual = (formats || []).filter((f) => f.template_type === 'annual');

  const now = new Date();
  const [form, setForm] = useState({ format_id: '', year: String(now.getFullYear()), month: '', opens_at: toLocalInput(now), closes_at: toLocalInput(new Date(now.getTime() + 7 * 86400000)), zone_id: '' });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);       // id of the period whose woredas are shown
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);       // { id, opens_at, closes_at }

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

  const show = async (w) => {
    if (open === w.id) { setOpen(null); return; }
    try { setDetail(await reportWindowService.get(w.id)); setOpen(w.id); } catch (err) { error(errorMessage(err)); }
  };
  const run = async (fn, msg) => { try { await fn(); success(msg); setEdit(null); setOpen(null); reload(); } catch (err) { error(errorMessage(err)); } };
  const saveDates = (w) => run(() => reportWindowService.update(w.id, { opens_at: fromLocalInput(edit.opens_at), closes_at: fromLocalInput(edit.closes_at) }), 'Dates updated');
  const closeNow = (w) => window.confirm(`Close ${monthName(w.month)} ${w.year} now? Woredas that haven't submitted won't be able to.`)
    && run(() => reportWindowService.update(w.id, { closes_at: new Date().toISOString() }), 'Reporting period closed');
  const remove = (w) => window.confirm(`Remove ${monthName(w.month)} ${w.year}?`) && run(() => reportWindowService.remove(w.id), 'Reporting period removed');

  if (!ref || loading) return <Loader />;

  return (
    <>
      <Header title="Reporting periods" subtitle="Open a month for the woredas to report in, with a deadline." />
      <ReportTabs />

      {canOpen && (
        <Card title="Open a reporting period" className="mb-6">
          {!annual.length ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">There is no approved <em>annual</em> report format yet. Quarterly, half-year and annual reports are summed up from the monthly ones, so create a monthly format first.</p>
          ) : (
            <form onSubmit={openPeriod} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="label" htmlFor="rp-format">Report format</label>
                  <select id="rp-format" className="input" value={form.format_id} onChange={(e) => chooseFormat(e.target.value)}>
                    <option value="">All teams' annual formats</option>
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
                  <input id="rp-opens" type="datetime-local" required className="input" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="rp-closes">Deadline</label>
                  <input id="rp-closes" type="datetime-local" required className="input" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
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

      {!windows?.length ? (
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">No reporting period has been opened yet.</p></Card>
      ) : (
        <div className="space-y-4">
          {windows.map((w) => {
            const pct = w.woreda_count ? Math.round((w.submitted_count / w.woreda_count) * 100) : 0;
            const editing = edit?.id === w.id;
            return (
              <Card key={w.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {w.template_title} — {monthName(w.month)} {w.year}
                      <Badge tone={STATE_TONE[w.state]}>{w.state}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {w.team_name || '—'} · {w.zone_name} · opens {fmtDateTime(w.opens_at)} · deadline {fmtDateTime(w.closes_at)}{w.state === 'open' ? ` · ${timeLeft(w.closes_at)}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => show(w)}>{open === w.id ? 'Hide woredas' : 'Show woredas'}</Button>
                    {canOpen && !editing && <Button variant="secondary" onClick={() => setEdit({ id: w.id, opens_at: toLocalInput(w.opens_at), closes_at: toLocalInput(w.closes_at) })}>Change dates</Button>}
                    {canOpen && w.state === 'open' && <Button variant="secondary" onClick={() => closeNow(w)}>Close now</Button>}
                    {canOpen && w.submitted_count === 0 && <Button variant="secondary" onClick={() => remove(w)}>Remove</Button>}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{w.submitted_count} of {w.woreda_count} woredas have submitted</span><span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {editing && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
                    <div><label className="label">Opens</label><input type="datetime-local" className="input" value={edit.opens_at} onChange={(e) => setEdit({ ...edit, opens_at: e.target.value })} /></div>
                    <div><label className="label">Deadline</label><input type="datetime-local" className="input" value={edit.closes_at} onChange={(e) => setEdit({ ...edit, closes_at: e.target.value })} /></div>
                    <Button onClick={() => saveDates(w)}>Save</Button>
                    <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
                  </div>
                )}

                {open === w.id && detail?.id === w.id && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                        <tr><th className="px-3 py-2 font-medium">Woreda</th><th className="px-3 py-2 font-medium">Report</th><th className="px-3 py-2 font-medium">Submitted</th><th className="px-3 py-2 font-medium">Timing</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {detail.woredas.map((x) => {
                          const submitted = x.status && x.status !== 'draft';
                          const late = submitted && x.submitted_at && new Date(x.submitted_at) > new Date(w.closes_at);
                          return (
                            <tr key={x.woreda_id}>
                              <td className="px-3 py-2 font-medium">{x.report_id && submitted ? <Link className="hover:underline" to={`/reports/${x.report_id}`}>{x.name}</Link> : x.name}</td>
                              <td className="px-3 py-2">{x.status ? <Badge tone={REPORT_TONE[x.status]}>{x.status === 'draft' ? 'draft (not submitted)' : x.status}</Badge> : <span className="text-slate-400">not started</span>}</td>
                              <td className="px-3 py-2 text-xs">{submitted ? fmtDateTime(x.submitted_at) : '—'}</td>
                              <td className="px-3 py-2 text-xs">
                                {submitted ? (late ? <span className="text-red-600 dark:text-red-400">late</span> : <span className="text-emerald-600 dark:text-emerald-400">on time</span>)
                                  : w.state === 'closed' ? <span className="text-red-600 dark:text-red-400">missed the deadline</span>
                                    : w.state === 'upcoming' ? <span className="text-slate-400">not open yet</span> : <span className="text-amber-600 dark:text-amber-400">waiting</span>}
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
