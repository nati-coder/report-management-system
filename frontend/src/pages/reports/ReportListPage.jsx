import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Table from '../../components/common/Table.jsx';
import Loader from '../../components/common/Loader.jsx';
import ReportTabs from '../../components/reports/ReportTabs.jsx';
import ReportStatusBadge, { statusLabel } from '../../components/reports/ReportStatusBadge.jsx';
import useReports from '../../hooks/useReports.js';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as referenceService from '../../services/referenceService.js';
import { isWoredaUser } from '../../utils/roleHelpers.js';
import { formatDate } from '../../utils/formatters.js';
import { MONTH_NAMES, MONTH_NUMBERS } from '../../utils/planSplit.js';

export default function ReportListPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params);
  const { data, loading, error } = useReports(filters);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Zonal users / admins browse reports across woredas, so they get a woreda filter.
  const browsesWoredas = !isWoredaUser(user);
  const { data: ref } = useFetch(() => (browsesWoredas ? referenceService.all() : Promise.resolve(null)), [browsesWoredas]);
  const woredas = (ref?.woredas || []).filter((w) => !user.zone_id || w.zone_id === user.zone_id);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'woreda_name', header: 'Woreda' },
    { key: 'team_name', header: 'Team' },
    { key: 'type', header: 'Type' },
    { key: 'period', header: 'Period', render: (r) => `${r.year}${r.month ? ` ${MONTH_NAMES[MONTH_NUMBERS.indexOf(r.month)] ?? r.month}` : r.quarter ? ` Q${r.quarter}` : ''}` },
    { key: 'status', header: 'Status', render: (r) => <ReportStatusBadge status={r.status} /> },
    { key: 'submitted_at', header: 'Submitted', render: (r) => formatDate(r.submitted_at) },
  ];

  // Zonal users only ever see what a woreda has submitted — drafts stay with the woreda.
  const statuses = browsesWoredas && user.zone_id ? ['submitted', 'reviewing', 'approved', 'rejected'] : ['draft', 'pending_woreda', 'woreda_approved', 'submitted', 'reviewing', 'approved', 'rejected'];

  return (
    <>
      <Header
        title="Reports"
        subtitle={browsesWoredas ? 'Reports submitted by woredas.' : undefined}
        actions={isWoredaUser(user) && <Link to="/reports/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">New report</Link>}
      />
      {browsesWoredas && <ReportTabs />}
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input w-44" value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        {browsesWoredas && (
          <select className="input w-52" value={filters.woreda_id || ''} onChange={(e) => setFilter('woreda_id', e.target.value)}>
            <option value="">All woredas</option>
            {woredas.map((w) => <option key={w.woreda_id} value={w.woreda_id}>{w.name}</option>)}
          </select>
        )}
      </div>
      {loading ? <Loader /> : error ? <p className="text-red-600 dark:text-red-400">{error}</p> : (
        <Table columns={columns} rows={data} empty="No reports found." onRowClick={(r) => navigate(`/reports/${r.id}`)} />
      )}
    </>
  );
}
