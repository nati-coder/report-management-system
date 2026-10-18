import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as templateService from '../../services/templateService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

const EMPTY = { versionId: '', title: '', type: 'monthly', end_year: '', templateVersion: '1.0' };

/**
 * Zonal Plan Expert: pick a report version, then create one report template
 * per team in that version's department in a single bulk call. Teams that
 * already have a template under the version are skipped automatically.
 */
export default function CreateTeamTemplatesModal({ open, versions, teams, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (open) setForm(EMPTY); }, [open]);

  const version = versions.find((v) => String(v.id) === String(form.versionId));
  const teamCount = version ? teams.filter((t) => t.department_id === version.dep_id).length : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!version) return error('Choose a report version');
    setBusy(true);
    try {
      const result = await templateService.createForVersion({
        version_id: version.id,
        title: form.title,
        type: form.type,
        start_year: version.year,
        end_year: form.end_year ? Number(form.end_year) : null,
        templateVersion: form.templateVersion,
      });
      success(`Created ${result.created.length} template(s)${result.skipped ? `, skipped ${result.skipped} team(s) that already had one` : ''}`);
      onCreated?.();
      onClose();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create templates for every team"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!version} form="bulk-templates-form" type="submit">Create for all teams</Button></>}>
      <form id="bulk-templates-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Report version</label>
          <select required className="input" value={form.versionId} onChange={(e) => setForm({ ...form, versionId: e.target.value })}>
            <option value="">Select…</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.year}){v.approval_date ? '' : ' — draft'}</option>)}
          </select>
          {version && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Creates one template per team ({teamCount} team{teamCount === 1 ? '' : 's'}) in this version's department, starting {version.year}. Teams that already have a template under this version are skipped.
            </p>
          )}
        </div>
        <div>
          <label className="label">Title</label>
          <input required className="input" placeholder="e.g. Monthly Health Report" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Each team's name is appended automatically, e.g. "{form.title || 'Title'} — Immunization".</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="annual">annual</option>
            </select>
          </div>
          <div>
            <label className="label">Template version</label>
            <input required className="input" value={form.templateVersion} onChange={(e) => setForm({ ...form, templateVersion: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">End year (optional)</label>
          <input type="number" className="input" value={form.end_year} onChange={(e) => setForm({ ...form, end_year: e.target.value })} />
        </div>
      </form>
    </Modal>
  );
}
