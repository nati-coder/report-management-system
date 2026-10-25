import { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as templateService from '../../services/templateService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

const EMPTY = { mode: 'all', versionId: '', teamId: '', title: '' };

/**
 * Zonal Plan Expert: create report templates. A team can have only ONE template per report version.
 *  - "Create for All Teams" (default): needs only the Report Version and a Title; one template is created for every
 *    team of the version's department, skipping teams that already have one.
 *  - "Create for Specific Team": needs the Report Version, the Team and a Title.
 * Everything else (type, start year, template version, sections …) is optional and can be set later with Edit.
 * Closed report versions are never offered.
 */
export default function CreateTemplateModal({ open, versions, teams, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (open) setForm(EMPTY); }, [open]);

  const openVersions = useMemo(() => versions.filter((v) => !v.closed_at), [versions]);
  const version = openVersions.find((v) => String(v.id) === String(form.versionId));
  const versionTeams = version ? teams.filter((t) => t.department_id === version.dep_id) : [];
  const specific = form.mode === 'team';
  const ready = !!version && form.title.trim().length >= 2 && (!specific || !!form.teamId);

  const setMode = (mode) => setForm({ ...form, mode, teamId: '' });
  const setVersion = (versionId) => setForm({ ...form, versionId, teamId: '' });

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      if (specific) {
        await templateService.create({ version_id: version.id, team_id: Number(form.teamId), department_id: version.dep_id, title: form.title.trim() });
        success('Template created');
      } else {
        const result = await templateService.createForVersion({ version_id: version.id, title: form.title.trim() });
        success(`Created ${result.created.length} template(s)${result.skipped ? `, skipped ${result.skipped} team(s) that already had one` : ''}`);
      }
      onCreated?.();
      onClose();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create report template"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!ready} form="create-template-form" type="submit">{specific ? 'Create for team' : 'Create for all teams'}</Button></>}>
      <form id="create-template-form" onSubmit={submit} className="space-y-4">
        <fieldset className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="radio" name="mode" className="mt-1" checked={!specific} onChange={() => setMode('all')} />
            <span><strong>Create for All Teams</strong> <span className="text-slate-400 dark:text-slate-500">(default)</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="radio" name="mode" className="mt-1" checked={specific} onChange={() => setMode('team')} />
            <span><strong>Create for Specific Team</strong></span>
          </label>
        </fieldset>

        <div>
          <label className="label">Report version</label>
          <select required className="input" value={form.versionId} onChange={(e) => setVersion(e.target.value)}>
            <option value="">Select…</option>
            {openVersions.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.year}){v.approval_date ? '' : ' — draft'}</option>)}
          </select>
          {!openVersions.length && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">There is no open report version. Closed versions can't take new templates.</p>}
          {version && !specific && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Creates one template for each of the {versionTeams.length} team{versionTeams.length === 1 ? '' : 's'} in this version's department. A team that already has a template under this version is skipped.
            </p>
          )}
        </div>

        {specific && (
          <div>
            <label className="label">Team</label>
            <select required className="input" value={form.teamId} disabled={!version} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">{version ? 'Select…' : 'Choose a report version first'}</option>
              {versionTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A team can have only one template per report version.</p>
          </div>
        )}

        <div>
          <label className="label">Title</label>
          <input required minLength={2} className="input" placeholder="e.g. Monthly Health Report" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {!specific && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Each team's name is appended automatically, e.g. "{form.title || 'Title'} — Immunization".</p>}
        </div>
      </form>
    </Modal>
  );
}
