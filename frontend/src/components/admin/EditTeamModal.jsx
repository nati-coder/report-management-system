import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

export default function EditTeamModal({ team, departments, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', department_id: '' });
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (team) setForm({ name: team.name || '', department_id: team.department_id || '' }); }, [team]);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await referenceService.updateTeam(team.id, { ...form, department_id: Number(form.department_id) }); success('Team updated'); onSaved(); onClose(); }
    catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!team} onClose={onClose} title={`Edit team: ${team?.name ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} form="edit-team-form" type="submit">Save</Button></>}>
      <form id="edit-team-form" onSubmit={save} className="space-y-3">
        <div><label className="label">Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Department</label>
          <select required className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
      </form>
    </Modal>
  );
}
