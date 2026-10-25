import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Table from '../../components/common/Table.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import CreateTemplateModal from '../../components/templates/CreateTemplateModal.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as templateService from '../../services/templateService.js';
import * as referenceService from '../../services/referenceService.js';
import { ROLES } from '../../utils/roleHelpers.js';
import { formatDate } from '../../utils/formatters.js';

/**
 * Zonal Plan Expert > Report Templates.
 * Lists the team report templates and creates new ones (for all teams, or for one team). A template always
 * belongs to a report version, which is chosen when the template is created; a team has one template per version.
 * Closed report versions can't take new templates or edits.
 */
export default function TemplateListPage() {
  const { user } = useAuth();
  const [versionFilter, setVersionFilter] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

  const scoped = user.role !== ROLES.ADMIN && user.department_id;
  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: versions } = useFetch(() => templateService.versions(scoped ? { dep_id: user.department_id } : {}), []);

  const params = {
    ...(scoped ? { department_id: user.department_id } : {}),
    ...(versionFilter ? { version_id: versionFilter } : {}),
  };
  const { data: templates, loading, error, reload } = useFetch(() => templateService.list(params), [JSON.stringify(params)]);

  if (!ref || !versions) return <Loader />;

  const versionOf = (id) => versions.find((v) => v.id === id);
  const teamName = (id) => ref.teams.find((t) => t.id === id)?.name || '—';

  const columns = [
    { key: 'title', header: 'Template' },
    { key: 'version', header: 'Report Version', render: (t) => {
      const v = versionOf(t.version_id);
      return v ? <>{v.name} <span className="text-slate-400 dark:text-slate-500">({v.year})</span>{v.closed_at && <> <Badge tone="gray">closed</Badge></>}</> : '—';
    } },
    { key: 'team', header: 'Team', render: (t) => teamName(t.team_id) },
    { key: 'type', header: 'Type' },
    { key: 'period', header: 'Period', render: (t) => `${t.start_year}${t.end_year ? `–${t.end_year}` : '+'}` },
    { key: 'active_flag', header: 'Status', render: (t) => <Badge tone={t.active_flag ? 'green' : 'gray'}>{t.active_flag ? 'active' : 'inactive'}</Badge> },
    { key: 'created_at', header: 'Created', render: (t) => formatDate(t.created_at) },
    { key: 'actions', header: '', render: (t) => (versionOf(t.version_id)?.closed_at
      ? <span className="text-xs text-slate-400 dark:text-slate-500">Version closed</span>
      : <Link className="text-brand-600 hover:underline dark:text-brand-400" to={`/templates/${t.id}`}>Edit</Link>) },
  ];

  return (
    <>
      <Header
        title="Report Templates"
        subtitle="Team report templates — one per team per report version. Create them for all teams at once or for a specific team."
        actions={<Button onClick={() => setBulkOpen(true)}>Create template</Button>}
      />
      <div className="mb-4">
        <select className="input w-72" value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)}>
          <option value="">All report versions</option>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.year}){v.closed_at ? ' — closed' : ''}</option>)}
        </select>
      </div>
      {loading ? <Loader /> : error ? <p className="text-red-600 dark:text-red-400">{error}</p> : (
        <Table columns={columns} rows={templates || []} empty="No report templates yet — create them with “Create template”." />
      )}
      <CreateTemplateModal open={bulkOpen} versions={versions} teams={ref.teams} onClose={() => setBulkOpen(false)} onCreated={reload} />
    </>
  );
}
