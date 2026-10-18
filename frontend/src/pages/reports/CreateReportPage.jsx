import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import useFetch from '../../hooks/useFetch.js';
import * as planService from '../../services/planService.js';
import * as reportService from '../../services/reportService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import * as reportWindowService from '../../services/reportWindowService.js';
import { monthName, fmtDateTime, timeLeft } from '../../utils/periods.js';

/**
 * A report is filed against an annual plan the woreda has ACCEPTED: the plan fixes the report format and
 * the year, and the entry form then offers only the items that plan has a target for.
 */
export default function CreateReportPage() {
  const navigate = useNavigate();
  const { error } = useNotify();
  // The server already limits these to the user's woreda, department and (for experts / team leaders) team.
  const { data: plans, loading } = useFetch(() => planService.list({ status: 'approved' }), []);
  // A monthly report can only be filed while the zone has that month open — between its opening time and deadline.
  const { data: windows, loading: windowsLoading } = useFetch(() => reportWindowService.list({ open: true }), []);
  const accepted = (plans || []).filter((p) => !p.month && !p.quarter);
  const [form, setForm] = useState({ plan_id: '', title: '', month: '', quarter: '' });
  const [busy, setBusy] = useState(false);
  const plan = accepted.find((p) => String(p.id) === String(form.plan_id));
  const byMonth = ['monthly', 'annual'].includes(plan?.template_type); // an annual format is reported month by month
  const openMonths = byMonth ? (windows || []).filter((w) => w.format_id === plan.format_id && w.year === plan.year) : [];
  const chosenWindow = openMonths.find((w) => String(w.month) === String(form.month));
  const blocked = byMonth && !openMonths.length;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        format_id: plan.format_id, title: form.title, type: byMonth ? 'monthly' : plan.template_type, year: plan.year, data: {},
        ...(byMonth ? { month: Number(form.month) } : {}), ...(plan.template_type === 'quarterly' ? { quarter: Number(form.quarter) } : {})
      };
      const r = await reportService.create(body);
      navigate(`/reports/${r.id}`);
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  if (loading || windowsLoading) return <Loader />;
  return (
    <>
      <Header title="New report" subtitle="Reports are filed against the annual plan your woreda has accepted." />
      <Card className="max-w-xl">
        {!accepted.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your woreda has no accepted annual plan yet, so there is nothing to report against. The Woreda Department Head must accept the plan
            {' '}under <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/plans">Annual Plans</Link> first.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><label className="label">Annual plan</label>
              <select required className="input" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
                <option value="">Select…</option>
                {accepted.map((p) => <option key={p.id} value={p.id}>{p.template_title} — {p.team_name || 'no team'} · {p.year} ({p.template_type})</option>)}
              </select>
            </div>
            <div><label className="label">Title</label><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Year</label><input className="input" value={plan?.year ?? ''} readOnly disabled /></div>
              {byMonth && !blocked && (
                <div><label className="label">Month (open for reporting)</label>
                  <select required className="input" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
                    <option value="">Select…</option>
                    {openMonths.map((w) => <option key={w.id} value={w.month}>{monthName(w.month)}</option>)}
                  </select></div>
              )}
              {plan?.template_type === 'quarterly' && <div><label className="label">Quarter</label><input type="number" min="1" max="4" required className="input" value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })} /></div>}
            </div>
            {blocked && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                No month is open for this report right now. The zonal plan expert opens a month with a deadline; you will be notified when one opens.
              </p>
            )}
            {chosenWindow && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {monthName(chosenWindow.month)} can be submitted until <strong>{fmtDateTime(chosenWindow.closes_at)}</strong> ({timeLeft(chosenWindow.closes_at)}).
              </p>
            )}
            <Button type="submit" loading={busy} disabled={!plan || blocked}>Create draft</Button>
          </form>
        )}
      </Card>
    </>
  );
}
