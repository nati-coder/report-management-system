import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Table from '../../components/common/Table.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as templateService from '../../services/templateService.js';
import * as referenceService from '../../services/referenceService.js';
import api, { unwrap, errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { formatDate } from '../../utils/formatters.js';

const EMPTY = { title: '', year: new Date().getFullYear(), versionNumber: '1.0', department_id: '' };

/** Report Versions: annual reporting cycles. Admin / Zonal Dept Head create and approve them. */
export default function ReportVersionsPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotify();
  const { data: versions, loading, error: loadError, reload } = useFetch(() => templateService.versions(), []);
  const { data: ref } = useFetch(() => referenceService.all(), []);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canManage = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD].includes(user.role);

  const createVersion = async (e) => {
    e.preventDefault();
    if (!form.department_id) return notifyError('Choose a department');
    setSaving(true);
    try {
      await unwrap(api.post('/templates/versions', {
        name: `v${form.versionNumber} — ${form.title}`,
        year: Number(form.year),
        dep_id: Number(form.department_id),
        nodes: [],
      }));
      success('Report version created');
      setForm(EMPTY);
      reload();
    } catch (err) { notifyError(errorMessage(err)); } finally { setSaving(false); }
  };

  const approve = async (v) => {
    try { await unwrap(api.post(`/templates/versions/${v.id}/approve`)); success('Report version approved'); reload(); }
    catch (err) { notifyError(errorMessage(err)); }
  };

  const statusOf = (v) => (v.approval_date ? 'approved' : 'draft');

  const columns = [
    { key: 'name', header: 'Report Version' },
    { key: 'year', header: 'Year' },
    { key: 'status', header: 'Status', render: (v) => <Badge tone={statusOf(v) === 'approved' ? 'green' : 'gray'}>{statusOf(v)}</Badge> },
    { key: 'created_at', header: 'Created', render: (v) => formatDate(v.created_at) },
    ...(canManage ? [{
      key: 'actions', header: '', render: (v) => (
        statusOf(v) === 'draft'
          ? <Button onClick={() => approve(v)}>Approve</Button>
          : <span className="text-xs text-slate-400 dark:text-slate-500">Approved {formatDate(v.approval_date)}</span>
      ),
    }] : []),
  ];

  if (loading || !ref) return <Loader />;

  return (
    <>
      <Header title="Report Versions" subtitle="The annual reporting cycles that report templates, plans and reports are organized under." />
      {canManage && (
        <Card title="New report version" className="mb-6">
          <form onSubmit={createVersion} className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="label">Title / description</label>
              <input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Year</label>
              <input required type="number" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div>
              <label className="label">Version number</label>
              <input required className="input" placeholder="1.0" value={form.versionNumber} onChange={(e) => setForm({ ...form, versionNumber: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <label className="label">Department</label>
              <select required className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">Select…</option>
                {ref.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" loading={saving}>Create report version</Button>
            </div>
          </form>
        </Card>
      )}
      {loadError ? <p className="text-red-600 dark:text-red-400">{loadError}</p> : <Table columns={columns} rows={versions || []} empty="No report versions yet" />}
    </>
  );
}
