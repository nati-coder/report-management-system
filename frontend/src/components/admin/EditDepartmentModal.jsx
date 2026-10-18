import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

export default function EditDepartmentModal({ department, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', amharic_name: '' });
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  useEffect(() => { if (department) setForm({ name: department.name || '', amharic_name: department.amharic_name || '' }); }, [department]);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await referenceService.updateDepartment(department.id, form); success('Department updated'); onSaved(); onClose(); }
    catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!department} onClose={onClose} title={`Edit department: ${department?.name ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} form="edit-dept-form" type="submit">Save</Button></>}>
      <form id="edit-dept-form" onSubmit={save} className="space-y-3">
        <div><label className="label">Name</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Amharic name</label><input required className="input" value={form.amharic_name} onChange={(e) => setForm({ ...form, amharic_name: e.target.value })} /></div>
      </form>
    </Modal>
  );
}
