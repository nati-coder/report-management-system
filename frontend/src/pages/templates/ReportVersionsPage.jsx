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
import { currentFiscalYear } from '../../utils/periods.js';

const EMPTY = { title: '', year: currentFiscalYear(), versionNumber: '1.0', department_id: '' };

/**
 * Report Versions: annual reporting cycles (Ethiopian fiscal year). Admin / Zonal Dept Head create and approve them;
 * only the System Admin closes one — normally after Sene, when no more templates or updates should be made.
 */
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
        // the title is optional: without one the version is just "v1.0"
        name: form.title.trim() ? `v${form.versionNumber} — ${form.title.trim()}` : `v${form.versionNumber}`,
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

  const close = async (v) => {
    if (!window.confirm(`Close "${v.name}"? No further templates or updates will be allowed under it, and it will no longer be offered when creating templates.`)) return;
    try { await templateService.closeVersion(v.id); success('Report version closed'); reload(); }
    catch (err) { notifyError(errorMessage(err)); }
  };

  const isAdmin = user.role === ROLES.ADMIN;
  const statusOf = (v) => (v.closed_at ? 'closed' : v.approval_date ? 'approved' : 'draft');
  const toneOf = { closed: 'red', approved: 'green', draft: 'gray' };

  const columns = [
    { key: 'name', header: 'Report Version' },
    { key: 'year', header: 'Year (EC)' },
    { key: 'status', header: 'Status', render: (v) => <Badge tone={toneOf[statusOf(v)]}>{statusOf(v)}</Badge> },
    { key: 'created_at', header: 'Created', render: (v) => formatDate(v.created_at) },
    ...(canManage ? [{
      key: 'actions', header: '', render: (v) => (
        <div className="flex items-center gap-2">
          {statusOf(v) === 'draft' && <Button onClick={() => approve(v)}>Approve</Button>}
          {statusOf(v) === 'approved' && <span className="text-xs text-slate-400 dark:text-slate-500">Approved {formatDate(v.approval_date)}</span>}
          {statusOf(v) === 'closed' && <span className="text-xs text-slate-400 dark:text-slate-500">Closed {formatDate(v.closed_at)}</span>}
          {isAdmin && statusOf(v) !== 'closed' && <Button variant="danger" onClick={() => close(v)}>Close version</Button>}
        </div>
      ),
    }] : []),
  ];

  if (loading || !ref) return <Loader />;

  return (
    <>
      <Header title="Report Versions" subtitle="The annual reporting cycles (Ethiopian fiscal year, Hamle–Sene) that report templates, plans and reports are organized under. Only the System Admin closes a version, at the end of the year." />
      {canManage && (
        <Card title="New report version" className="mb-6">
          <form onSubmit={createVersion} className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="label">Title / description <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span></label>
              <input className="input" placeholder="Optional — e.g. Annual health plan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Year (EC)</label>
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
