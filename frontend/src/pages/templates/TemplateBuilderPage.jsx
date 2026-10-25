import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Loader from '../../components/common/Loader.jsx';
import DynamicReportForm from '../../components/reports/DynamicReportForm.jsx';
import * as templateService from '../../services/templateService.js';
import * as referenceService from '../../services/referenceService.js';
import useAuth from '../../hooks/useAuth.js';
import useFetch from '../../hooks/useFetch.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import SchemaBuilderCard from '../../components/templates/SchemaBuilderCard.jsx';
import { newSection, sectionsToSchema, schemaToSections, validateSections } from '../../utils/schemaBuilder.js';
import { currentFiscalYear } from '../../utils/periods.js';

/** Sections are optional: a builder that is still empty means "no sections yet". */
const isBlank = (sections) => sections.every((s) => !s.title.trim() && s.fields.every((f) => !f.label.trim()));

export default function TemplateBuilderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useNotify();

  const { data: ref, loading: refLoading } = useFetch(() => referenceService.all(), []);
  const { data: versions, loading: versionsLoading } = useFetch(
    () => templateService.versions(user.role === ROLES.ADMIN ? {} : { dep_id: user.department_id }), []);

  const [versionId, setVersionId] = useState(searchParams.get('version_id') || '');
  const [teamId, setTeamId] = useState('');
  const [existingTemplateId, setExistingTemplateId] = useState(id || null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const [meta, setMeta] = useState({ title: '', type: 'monthly', start_year: currentFiscalYear(), end_year: '', templateVersion: '1.0' });
  const [sections, setSections] = useState([newSection()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const selectedVersion = useMemo(() => versions?.find((v) => String(v.id) === String(versionId)), [versions, versionId]);
  const teamsForVersion = useMemo(
    () => (ref?.teams || []).filter((t) => !selectedVersion || t.department_id === selectedVersion.dep_id), [ref, selectedVersion]);

  // Editing an existing template directly via /templates/:id — load it as-is.
  useEffect(() => {
    if (!id) return;
    templateService.get(id).then((t) => {
      setVersionId(String(t.version_id));
      setTeamId(String(t.team_id));
      setMeta({ title: t.title, type: t.type, start_year: t.start_year, end_year: t.end_year ?? '', templateVersion: t.version });
      setSections(schemaToSections(t.json_schema));
      setTitleTouched(true);
    }).catch((e) => error(errorMessage(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Version changed: reset team + auto-fill start year.
  useEffect(() => {
    if (id) return; // don't disturb a template being edited directly
    if (selectedVersion) setMeta((m) => ({ ...m, start_year: selectedVersion.year }));
    setTeamId('');
    setExistingTemplateId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  // Version + team both chosen (create flow only): check for an existing
  // template and switch into edit mode rather than allowing a duplicate.
  useEffect(() => {
    if (id || !versionId || !teamId) return;
    const team = (ref?.teams || []).find((t) => String(t.id) === String(teamId));
    setCheckingExisting(true);
    templateService.list({ version_id: versionId, team_id: teamId })
      .then(([found]) => {
        if (found) {
          setExistingTemplateId(found.id);
          setMeta({ title: found.title, type: found.type, start_year: found.start_year, end_year: found.end_year ?? '', templateVersion: found.version });
          setSections(schemaToSections(found.json_schema));
          setTitleTouched(true);
        } else {
          setExistingTemplateId(null);
          if (!titleTouched && selectedVersion && team) setMeta((m) => ({ ...m, title: `${selectedVersion.name} — ${team.name}` }));
        }
      })
      .catch((e) => error(errorMessage(e)))
      .finally(() => setCheckingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, teamId]);

  const selectedTeam = useMemo(() => (ref?.teams || []).find((t) => String(t.id) === String(teamId)), [ref, teamId]);

  // ---- validation (spec §4.4) ----
  const validate = () => {
    const e = {};
    if (!versionId) e.versionId = 'Choose a report version';
    if (!teamId) e.teamId = 'Choose a team';
    if (!meta.title || meta.title.trim().length < 2) e.title = 'Title is required (min 2 characters)';
    if (!isBlank(sections)) Object.assign(e, validateSections(sections));

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        title: meta.title,
        type: meta.type,
        start_year: Number(meta.start_year),
        end_year: meta.end_year === '' ? null : Number(meta.end_year),
        version: meta.templateVersion,
        version_id: Number(versionId),
        department_id: selectedVersion.dep_id,
        team_id: Number(teamId),
        // Sections are optional — leave them out while the builder is empty.
        ...(isBlank(sections) ? {} : { json_schema: sectionsToSchema(sections) }),
      };
      if (existingTemplateId) await templateService.update(existingTemplateId, body);
      else await templateService.create(body);
      success(existingTemplateId ? 'Template updated' : 'Template created');
      navigate('/templates');
    } catch (err) {
      error(errorMessage(err));
      if (err.response?.status === 409) {
        // Race with another Plan Expert — refetch and switch to edit mode.
        const [found] = await templateService.list({ version_id: versionId, team_id: teamId }).catch(() => []);
        if (found) { setExistingTemplateId(found.id); setSections(schemaToSections(found.json_schema)); }
      }
    } finally {
      setSaving(false);
    }
  };

  if (refLoading || versionsLoading) return <Loader />;

  const previewSchema = sectionsToSchema(sections);
  const versionClosed = !!selectedVersion?.closed_at;

  return (
    <>
      <Header
        title={existingTemplateId ? 'Edit team report template' : 'New team report template'}
        subtitle="Build the sections, KPIs and targets a specific team will report against for a report version."
        actions={<Button loading={saving} disabled={versionClosed} onClick={save}>{existingTemplateId ? 'Save changes' : 'Create template'}</Button>}
      />

      {versionClosed && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          This report version is closed — its templates can no longer be created or changed.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Report version & team">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Report version</label>
                <select className="input" value={versionId} disabled={!!id} onChange={(e) => setVersionId(e.target.value)}>
                  <option value="">Select…</option>
                  {(versions || []).filter((v) => !v.closed_at || String(v.id) === String(versionId)).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.year}){v.closed_at ? ' — closed' : v.approval_date ? '' : ' — draft'}</option>)}
                </select>
                {errors.versionId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.versionId}</p>}
              </div>
              <div>
                <label className="label">Team</label>
                <select className="input" value={teamId} disabled={!!id || !versionId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">{versionId ? 'Select…' : 'Choose a version first'}</option>
                  {teamsForVersion.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {errors.teamId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.teamId}</p>}
              </div>
            </div>
            {checkingExisting && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Checking for an existing template…</p>}
            {existingTemplateId && !checkingExisting && (
              <p className="mt-2 text-xs"><Badge tone="blue">Editing existing template</Badge> <span className="text-slate-400 dark:text-slate-500">— a template already exists for {selectedTeam?.name} under this version.</span></p>
            )}
          </Card>

          <Card title="Template details (only the title is required)">
            <div className="space-y-3">
              <div>
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input className="input" value={meta.title} onChange={(e) => { setTitleTouched(true); setMeta({ ...meta, title: e.target.value }); }} />
                {errors.title && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Type (optional)</label>
                  <select className="input" value={meta.type} onChange={(e) => setMeta({ ...meta, type: e.target.value })}>
                    <option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="annual">annual</option>
                  </select>
                </div>
                <div>
                  <label className="label">Start year (EC, optional)</label>
                  <input type="number" className="input" value={meta.start_year} onChange={(e) => setMeta({ ...meta, start_year: e.target.value })} />
                </div>
                <div>
                  <label className="label">Template version (optional)</label>
                  <input className="input" value={meta.templateVersion} onChange={(e) => setMeta({ ...meta, templateVersion: e.target.value })} />
                </div>
              </div>
            </div>
          </Card>

          <SchemaBuilderCard sections={sections} setSections={setSections} errors={errors} />
        </div>

        <Card title="Live preview">
          <DynamicReportForm schema={previewSchema} readOnly />
        </Card>
      </div>
    </>
  );
}
