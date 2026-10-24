import { Link } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import Header from '../../components/layout/Header.jsx';
import useReports from '../../hooks/useReports.js';
import useAuth from '../../hooks/useAuth.js';
import useFetch from '../../hooks/useFetch.js';
import Badge from '../../components/common/Badge.jsx';
import { statusLabel, STATUS_TONE } from '../../components/reports/ReportStatusBadge.jsx';
import * as reportWindowService from '../../services/reportWindowService.js';
import { isWoredaUser } from '../../utils/roleHelpers.js';
import { monthName, fmtDateTime, timeLeft } from '../../utils/periods.js';
import { ROLE_LABEL } from '../../utils/roleHelpers.js';
import { getLang } from '../../utils/formatters.js';

const ZONE_STATUSES = ['draft', 'submitted', 'reviewing', 'approved', 'rejected'];
// A woreda's reports pass its Woreda Plan Expert before they reach the zone.
const WOREDA_STATUSES = ['draft', 'pending_woreda', 'woreda_approved', 'submitted', 'reviewing', 'approved', 'rejected'];

/** Shared dashboard: status counters + role-specific quick actions */
export default function RoleDashboard({ actions = [] }) {
  const { user } = useAuth();
  const { data, loading, error } = useReports({ limit: 200 });
  // Woreda users: the months the zone has open for reporting, with the deadline and where their own report stands.
  const woreda = isWoredaUser(user);
  const STATUSES = woreda ? WOREDA_STATUSES : ZONE_STATUSES;
  const { data: openPeriods } = useFetch(() => (woreda ? reportWindowService.list({ open: true }) : Promise.resolve([])), [woreda]);
  const mine = (w) => (data || []).find((r) => r.format_id === w.format_id && r.year === w.year && r.month === w.month);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, (data || []).filter((r) => r.status === s).length]));

  return (
    <>
      <Header title={`Welcome, ${user.name}`} subtitle={ROLE_LABEL[user.role]?.[getLang()]} />
      {loading ? <Loader /> : error ? <p className="text-red-600">{error}</p> : (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATUSES.map((s) => (
            <Card key={s}><p className="text-xs uppercase text-slate-500 dark:text-slate-400">{statusLabel(s)}</p><p className="mt-1 text-2xl font-semibold dark:text-slate-100">{counts[s]}</p></Card>
          ))}
        </div>
      )}
      {woreda && openPeriods?.length > 0 && (
        <Card title="Open for reporting" className="mb-6">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {openPeriods.map((w) => {
              const r = mine(w);
              const filed = r && r.status !== 'draft' && r.status !== 'rejected';
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <div className="font-medium">{w.template_title} — {monthName(w.month)} {w.year}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Deadline {fmtDateTime(w.closes_at)} · {timeLeft(w.closes_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {filed ? <Badge tone={STATUS_TONE[r.status] || 'green'}>{statusLabel(r.status)}</Badge> : <Badge tone={r ? 'amber' : 'red'}>{r ? (r.status === 'rejected' ? 'rejected — fix and resubmit' : 'draft — not submitted') : 'not started'}</Badge>}
                    {!filed && <Link to={r ? `/reports/${r.id}` : '/reports/new'} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700">{r ? 'Continue' : 'Start report'}</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Card title="Quick actions">
        <div className="flex flex-wrap gap-3">
          {actions.map((a) => (
            <Link key={a.to} to={a.to} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">{a.label}</Link>
          ))}
        </div>
      </Card>
    </>
  );
}
