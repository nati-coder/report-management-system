import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { localName } from '../../utils/formatters.js';

export default function EditWoredaModal({ woreda, zones, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', name_amharic: '', zone_id: '' });
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (woreda) setForm({ name: woreda.name || '', name_amharic: woreda.name_amharic || '', zone_id: woreda.zone_id || '' }); }, [woreda]);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await referenceService.updateWoreda(woreda.woreda_id, form); success('Woreda updated'); onSaved(); onClose(); }
    catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!woreda} onClose={onClose} title={`Edit woreda: ${woreda?.woreda_id ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} form="edit-woreda-form" type="submit">Save</Button></>}>
      <form id="edit-woreda-form" onSubmit={save} className="space-y-3">
        <div><label className="label">Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Amharic name</label><input className="input" value={form.name_amharic} onChange={(e) => setForm({ ...form, name_amharic: e.target.value })} /></div>
        <div><label className="label">Zone</label>
          <select required className="input" value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
            {zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{localName(z)}</option>)}
          </select></div>
        <p className="text-xs text-slate-400 dark:text-slate-500">The woreda ID itself can't be changed here — it's used as a key elsewhere in the system.</p>
      </form>
    </Modal>
  );
}
