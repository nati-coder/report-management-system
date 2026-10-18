import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import Modal from '../../components/common/Modal.jsx';
import DynamicReportForm from '../../components/reports/DynamicReportForm.jsx';
import TreeBuilderCard from '../../components/formats/TreeBuilderCard.jsx';
import FormatTableCard from '../../components/formats/FormatTableCard.jsx';
import FormatStatusBadge from '../../components/formats/FormatStatusBadge.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as templateService from '../../services/templateService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { newNode, treeToSchema, schemaToTree, validateTree } from '../../utils/formatTree.js';
import { saveBlob, blobErrorMessage, slug } from '../../utils/download.js';

/**
 * Create / edit / review a report format.
 *  - /report-formats/new  : Zonal Expert / Team Leader pick a report template; its sections and numeric KPIs are the starting outline.
 *  - /report-formats/:id  : edit while draft/rejected, read-only otherwise; the Zonal Dept Head approves or rejects here.
 */
export default function FormatBuilderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useNotify();

  const canAuthor = [ROLES.ADMIN, ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER].includes(user.role);
  const canReview = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD].includes(user.role);
  const canCascade = [ROLES.ADMIN, ROLES.ZONAL_EXPERT].includes(user.role);
  const scoped = user.role !== ROLES.ADMIN && user.department_id;
  const teamScoped = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER].includes(user.role);
  // Only templates of the user's own department — and team, when the account has one (the server enforces the same rule).
  const scopeParams = { ...(scoped ? { department_id: user.department_id } : {}), ...(teamScoped && user.team_id ? { team_id: user.team_id } : {}) };

  const { data: format, loading: formatLoading, error: formatError, reload } = useFetch(() => (id ? reportFormatService.get(id) : Promise.resolve(null)), [id]);
  const { data: templates, loading: tplLoading } = useFetch(
    () => (id ? Promise.resolve([]) : templateService.list({ active: true, ...scopeParams })), [id]);
  const { data: versions } = useFetch(() => templateService.versions(scoped ? { dep_id: user.department_id } : {}), []);
  const { data: ref } = useFetch(() => referenceService.all(), []);

  const [templateId, setTemplateId] = useState(searchParams.get('template_id') || '');
  const [nodes, setNodes] = useState([newNode()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [downloading, setDownloading] = useState('');

  const template = useMemo(() => (templates || []).find((t) => String(t.id) === String(templateId)), [templates, templateId]);
  const versionName = (vid) => versions?.find((v) => v.id === vid)?.name || '—';
  const teamName = (tid) => ref?.teams.find((t) => t.id === tid)?.name || '—';
  const myDepartment = ref?.departments.find((d) => d.id === user.department_id)?.name;
  const myTeam = ref?.teams.find((t) => t.id === user.team_id)?.name;

  // Load an existing format into the editor.
  useEffect(() => {
    if (!format) return;
    setTemplateId(String(format.template_id));
    setNodes(schemaToTree(format.schema_definition));
    setErrors({});
  }, [format?.id, format?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  // New format: start from the chosen template's KPIs (the expert then adjusts them).
  const pickTemplate = (value) => {
    setTemplateId(value);
    const t = (templates || []).find((x) => String(x.id) === String(value));
    setNodes(schemaToTree(t?.json_schema));
    setErrors({});
  };
  useEffect(() => {
    if (!id && templateId && templates) pickTemplate(templateId);
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = canAuthor && (!id || ['draft', 'rejected'].includes(format?.status));

  const persist = async () => {
    const e = {};
    if (!id && !templateId) e.templateId = 'Choose a report template';
    Object.assign(e, validateTree(nodes));
    setErrors(e);
    if (Object.keys(e).length) return null;
    const schema_definition = treeToSchema(nodes);
    return id
      ? reportFormatService.update(id, { schema_definition })
      : reportFormatService.create({ template_id: Number(templateId), schema_definition });
  };

  const save = async (andSubmit) => {
    setSaving(true);
    try {
      const saved = await persist();
      if (!saved) return;
      if (andSubmit) await reportFormatService.submit(saved.id);
      success(andSubmit ? 'Submitted for approval' : 'Report format saved');
      if (andSubmit) navigate('/report-formats');
      else if (!id) navigate(`/report-formats/${saved.id}`, { replace: true });
      else reload();
    } catch (err) { error(errorMessage(err)); } finally { setSaving(false); }
  };

  const decide = async (action, rejection_reason) => {
    setSaving(true);
    try {
      await reportFormatService.review(id, { action, rejection_reason });
      success(action === 'approve' ? 'Report format approved' : 'Report format rejected');
      setRejecting(false); setReason('');
      reload();
    } catch (err) { error(errorMessage(err)); } finally { setSaving(false); }
  };

  const download = async (type) => {
    setDownloading(type);
    try {
      saveBlob(await reportFormatService.exportFile(id, type), `${slug(format.template_title)}-v${format.version}.${type}`);
    } catch (err) { error(await blobErrorMessage(err)); } finally { setDownloading(''); }
  };

  if ((id && formatLoading && !format) || tplLoading) return <Loader />;
  if (id && !format) return <p className="text-red-600 dark:text-red-400">{formatError || 'Report format not found.'}</p>;

  // An approved format is previewed as a table (downloadable / printable) rather than as an editor.
  const showTable = !!id && format.status === 'approved';

  return (
    <>
      <div className="print:hidden">
      <Header
        title={id ? `Report format — ${format.template_title}` : 'New report format'}
        subtitle={id
          ? `${format.version_name} · ${format.team_name} · format v${format.version}`
          : 'Lay out the items a team reports and is planned against — each with a title and a measurement, nested as deep as needed. It becomes usable once the Zonal Dept Head approves it.'}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {id && <FormatStatusBadge status={format.status} />}
            {editable && <Button variant="secondary" loading={saving} onClick={() => save(false)}>Save draft</Button>}
            {editable && <Button loading={saving} onClick={() => save(true)}>Save & submit for approval</Button>}
            {canReview && id && format.status === 'pending_approval' && (
              <>
                <Button loading={saving} onClick={() => decide('approve')}>Approve</Button>
                <Button variant="danger" onClick={() => setRejecting(true)}>Reject</Button>
              </>
            )}
            {canCascade && id && format.status === 'approved' && (
              <Link to={`/plans/cascade?format_id=${format.id}`} className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Cascade annual plan</Link>
            )}
          </div>
        )}
      />
      </div>

      {id && format.status === 'rejected' && format.rejection_reason && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 print:hidden">Rejected: {format.rejection_reason}. Edit the format and submit it again.</p>
      )}
      {id && format.status === 'pending_approval' && !canReview && (
        <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">Waiting for the Zonal Dept Head's approval. It can't be edited while pending.</p>
      )}

      {showTable ? (
        <FormatTableCard format={format} onDownload={download} downloading={downloading} />
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Report template">
            {id ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">{format.template_title}</span> — {format.version_name} ({format.version_year}) · Team: {format.team_name}
              </p>
            ) : (
              <>
                {user.role !== ROLES.ADMIN && (
                  <p className="mb-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
                    {!user.department_id
                      ? 'Your account has no department assigned, so no templates are available. Ask an admin to set your department and team.'
                      : <>Showing templates for <strong>{myDepartment || 'your department'}</strong>
                        {teamScoped && (user.team_id
                          ? <> · team <strong>{myTeam || 'your team'}</strong></>
                          : ' — no team is assigned to your account, so every team in your department is shown')}.</>}
                  </p>
                )}
                <label className="label">Choose the template this format belongs to</label>
                <select className="input" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                  <option value="">Select…</option>
                  {(templates || []).map((t) => <option key={t.id} value={t.id}>{t.title} — {versionName(t.version_id)} · {teamName(t.team_id)}</option>)}
                </select>
                {errors.templateId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.templateId}</p>}
                {template && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Started from this template's sections and numeric KPIs, laid out as items — restructure them freely.</p>}
                {!templates?.length && user.department_id && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {teamScoped && user.team_id ? `No active report templates for ${myTeam || 'your team'} yet.` : 'No active report templates yet.'} The Zonal Plan Expert creates those first.
                  </p>
                )}
              </>
            )}
          </Card>
          {id && !Array.isArray(format.schema_definition?.nodes) && (
            <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              This format was saved in the older section / KPI layout. It is shown here as an outline and will be saved in the new layout when you save it.
            </p>
          )}
          <TreeBuilderCard nodes={nodes} setNodes={setNodes} errors={errors} readOnly={!editable} title="Items" />
        </div>
        <Card title="Live preview">
          <DynamicReportForm schema={treeToSchema(nodes)} readOnly />
        </Card>
      </div>
      )}

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject report format"
        footer={<><Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button><Button variant="danger" loading={saving} disabled={!reason.trim()} onClick={() => decide('reject', reason.trim())}>Reject</Button></>}>
        <label className="label">Reason (shown to the author)</label>
        <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
