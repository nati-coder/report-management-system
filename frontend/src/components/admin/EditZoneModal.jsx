import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

export default function EditZoneModal({ zone, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', name_amharic: '' });
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (zone) setForm({ name: zone.name || '', name_amharic: zone.name_amharic || '' }); }, [zone]);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await referenceService.updateZone(zone.zone_id, form); success('Zone updated'); onSaved(); onClose(); }
    catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!zone} onClose={onClose} title={`Edit zone: ${zone?.zone_id ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} form="edit-zone-form" type="submit">Save</Button></>}>
      <form id="edit-zone-form" onSubmit={save} className="space-y-3">
        <div><label className="label">Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Amharic name</label><input className="input" value={form.name_amharic} onChange={(e) => setForm({ ...form, name_amharic: e.target.value })} /></div>
        <p className="text-xs text-slate-400 dark:text-slate-500">The zone ID itself can't be changed here — it's used as a key elsewhere in the system.</p>
      </form>
    </Modal>
  );
}
