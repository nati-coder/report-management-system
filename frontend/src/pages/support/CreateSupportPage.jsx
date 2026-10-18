import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import * as supportService from '../../services/supportService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

export default function CreateSupportPage() {
  const navigate = useNavigate();
  const { success, error } = useNotify();
  const [form, setForm] = useState({ title: '', description: '', category: '', priority: 'medium' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await supportService.create(form); success('Request sent'); navigate('/support'); }
    catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <Header title="New support request" />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Title</label><input required minLength={3} className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Describe the problem</label><textarea required rows={4} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>low</option><option>medium</option><option>high</option></select></div>
          </div>
          <Button type="submit" loading={busy}>Send request</Button>
        </form>
      </Card>
    </>
  );
}
