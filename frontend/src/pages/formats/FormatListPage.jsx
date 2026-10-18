import { Link, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Table from '../../components/common/Table.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import FormatStatusBadge from '../../components/formats/FormatStatusBadge.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { formatDate } from '../../utils/formatters.js';

const STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'];

/**
 * Report formats. Zonal Expert / Team Leader author them and submit for approval;
 * Zonal Dept Head reviews the ones pending approval.
 */
export default function FormatListPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotify();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';

  const canAuthor = [ROLES.ADMIN, ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER].includes(user.role);
  const canReview = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD].includes(user.role);
  const scoped = user.role !== ROLES.ADMIN && user.department_id;

  const query = { ...(scoped ? { department_id: user.department_id } : {}), ...(status ? { status } : {}) };
  const { data: formats, loading, error, reload } = useFetch(() => reportFormatService.list(query), [JSON.stringify(query)]);

  const submit = async (f) => {
    try { await reportFormatService.submit(f.id); success('Submitted for approval'); reload(); }
    catch (e) { notifyError(errorMessage(e)); }
  };

  const columns = [
    { key: 'template_title', header: 'Report template' },
    { key: 'version', header: 'Report version', render: (f) => <>{f.version_name} <span className="text-slate-400 dark:text-slate-500">({f.version_year})</span></> },
    { key: 'team_name', header: 'Team' },
    { key: 'rev', header: 'Format', render: (f) => `v${f.version}` },
    { key: 'status', header: 'Status', render: (f) => <FormatStatusBadge status={f.status} /> },
    { key: 'updated_at', header: 'Updated', render: (f) => formatDate(f.updated_at) },
    { key: 'actions', header: '', render: (f) => {
      const editable = canAuthor && ['draft', 'rejected'].includes(f.status);
      const reviewing = canReview && f.status === 'pending_approval';
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-brand-600 hover:underline dark:text-brand-400" to={`/report-formats/${f.id}`}>
            {editable ? 'Edit' : reviewing ? 'Review' : 'View'}
          </Link>
          {canAuthor && f.status === 'draft' && <Button variant="secondary" onClick={() => submit(f)}>Submit for approval</Button>}
        </div>
      );
    } },
  ];

  return (
    <>
      <Header
        title="Report Formats"
        subtitle="The approved form layout a team reports (and is planned) against. Drafts go to the Zonal Dept Head for approval."
        actions={canAuthor && (
          <Link to="/report-formats/new" className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">New report format</Link>
        )}
      />
      <div className="mb-4">
        <select className="input w-56" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      {loading ? <Loader /> : error ? <p className="text-red-600 dark:text-red-400">{error}</p> : (
        <Table columns={columns} rows={formats || []} empty="No report formats yet." />
      )}
    </>
  );
}
