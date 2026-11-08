import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Table from '../../components/common/Table.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import EditZoneModal from '../../components/admin/EditZoneModal.jsx';
import EditWoredaModal from '../../components/admin/EditWoredaModal.jsx';
import EditDepartmentModal from '../../components/admin/EditDepartmentModal.jsx';
import EditTeamModal from '../../components/admin/EditTeamModal.jsx';
import useFetch from '../../hooks/useFetch.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { localName } from '../../utils/formatters.js';

const EMPTY_ZONE = { zone_id: '', name: '', name_amharic: '' };
const EMPTY_WOREDA = { woreda_id: '', zone_id: '', name: '', name_amharic: '' };
const EMPTY_DEPT = { name: '', amharic_name: '' };
const EMPTY_TEAM = { name: '', department_id: '' };

const TABS = [{ key: 'locations', label: 'Zones & Woredas' }, { key: 'org', label: 'Departments & Teams' }];

/** Admin-only: manage the org hierarchy (zones/woredas for the geographic structure, departments/teams for reporting units). */
export default function LocationsPage() {
  const { data, loading, error, reload } = useFetch(() => referenceService.all(), []);
  const { success, error: notifyError } = useNotify();
  const [tab, setTab] = useState('locations');

  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE);
  const [woredaForm, setWoredaForm] = useState(EMPTY_WOREDA);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [savingZone, setSavingZone] = useState(false);
  const [savingWoreda, setSavingWoreda] = useState(false);
  const [savingDept, setSavingDept] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [editingWoreda, setEditingWoreda] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);

  const addZone = async (e) => {
    e.preventDefault(); setSavingZone(true);
    try { await referenceService.createZone(zoneForm); success('Zone created'); setZoneForm(EMPTY_ZONE); reload(); }
    catch (err) { notifyError(errorMessage(err)); } finally { setSavingZone(false); }
  };
  const addWoreda = async (e) => {
    e.preventDefault(); setSavingWoreda(true);
    try { await referenceService.createWoreda(woredaForm); success('Woreda created'); setWoredaForm(EMPTY_WOREDA); reload(); }
    catch (err) { notifyError(errorMessage(err)); } finally { setSavingWoreda(false); }
  };
  const addDept = async (e) => {
    e.preventDefault(); setSavingDept(true);
    try { await referenceService.createDepartment(deptForm); success('Department created'); setDeptForm(EMPTY_DEPT); reload(); }
    catch (err) { notifyError(errorMessage(err)); } finally { setSavingDept(false); }
  };
  const addTeam = async (e) => {
    e.preventDefault(); setSavingTeam(true);
    try { await referenceService.createTeam({ ...teamForm, department_id: Number(teamForm.department_id) }); success('Team created'); setTeamForm(EMPTY_TEAM); reload(); }
    catch (err) { notifyError(errorMessage(err)); } finally { setSavingTeam(false); }
  };

  const removeZone = async (zone) => {
    if (!window.confirm(`Delete zone "${zone.name}"? This cannot be undone.`)) return;
    try { await referenceService.deleteZone(zone.zone_id); success('Zone deleted'); reload(); }
    catch (err) { notifyError(errorMessage(err)); }
  };
  const removeWoreda = async (woreda) => {
    if (!window.confirm(`Delete woreda "${woreda.name}"? This cannot be undone.`)) return;
    try { await referenceService.deleteWoreda(woreda.woreda_id); success('Woreda deleted'); reload(); }
    catch (err) { notifyError(errorMessage(err)); }
  };
  const removeDept = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"? This cannot be undone.`)) return;
    try { await referenceService.deleteDepartment(dept.id); success('Department deleted'); reload(); }
    catch (err) { notifyError(errorMessage(err)); }
  };
  const removeTeam = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    try { await referenceService.deleteTeam(team.id); success('Team deleted'); reload(); }
    catch (err) { notifyError(errorMessage(err)); }
  };

  if (loading) return <Loader />;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <Header title="Organization structure" subtitle="Zones, woredas, departments and teams used across reports, rankings and user placement." />
      <div className="mb-5 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === tb.key ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'locations' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Zones">
            <form onSubmit={addZone} className="mb-4 grid grid-cols-3 gap-2">
              <input required placeholder="Zone ID (e.g. Z02)" className="input" value={zoneForm.zone_id} onChange={(e) => setZoneForm({ ...zoneForm, zone_id: e.target.value })} />
              <input required placeholder="Name" className="input" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
              <input placeholder="Amharic name (optional)" className="input" value={zoneForm.name_amharic} onChange={(e) => setZoneForm({ ...zoneForm, name_amharic: e.target.value })} />
              <Button type="submit" loading={savingZone} className="col-span-3">Add zone</Button>
            </form>
            <Table
              columns={[
                { key: 'zone_id', header: 'ID' },
                { key: 'name', header: 'Name', render: (z) => localName(z) },
                { key: 'woredas', header: 'Woredas', render: (z) => data.woredas.filter((w) => w.zone_id === z.zone_id).length },
                { key: 'actions', header: '', render: (z) => (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditingZone(z)}>Edit</Button>
                    <Button variant="danger" onClick={() => removeZone(z)}>Delete</Button>
                  </div>
                ) },
              ]}
              rows={data.zones} empty="No zones yet"
            />
          </Card>
          <Card title="Woredas">
            <form onSubmit={addWoreda} className="mb-4 grid grid-cols-2 gap-2">
              <input required placeholder="Woreda ID (e.g. W02)" className="input" value={woredaForm.woreda_id} onChange={(e) => setWoredaForm({ ...woredaForm, woreda_id: e.target.value })} />
              <select required className="input" value={woredaForm.zone_id} onChange={(e) => setWoredaForm({ ...woredaForm, zone_id: e.target.value })}>
                <option value="">Zone…</option>
                {data.zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{localName(z)}</option>)}
              </select>
              <input required placeholder="Name" className="input" value={woredaForm.name} onChange={(e) => setWoredaForm({ ...woredaForm, name: e.target.value })} />
              <input placeholder="Amharic name (optional)" className="input" value={woredaForm.name_amharic} onChange={(e) => setWoredaForm({ ...woredaForm, name_amharic: e.target.value })} />
              <Button type="submit" loading={savingWoreda} className="col-span-2">Add woreda</Button>
            </form>
            <Table
              columns={[
                { key: 'woreda_id', header: 'ID' },
                { key: 'name', header: 'Name', render: (w) => localName(w) },
                { key: 'zone_id', header: 'Zone' },
                { key: 'actions', header: '', render: (w) => (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditingWoreda(w)}>Edit</Button>
                    <Button variant="danger" onClick={() => removeWoreda(w)}>Delete</Button>
                  </div>
                ) },
              ]}
              rows={data.woredas} empty="No woredas yet"
            />
          </Card>
        </div>
      )}

      {tab === 'org' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Departments">
            <form onSubmit={addDept} className="mb-4 grid grid-cols-2 gap-2">
              <input required placeholder="Name" className="input" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
              <input required placeholder="Amharic name" className="input" value={deptForm.amharic_name} onChange={(e) => setDeptForm({ ...deptForm, amharic_name: e.target.value })} />
              <Button type="submit" loading={savingDept} className="col-span-2">Add department</Button>
            </form>
            <Table columns={[{ key: 'name', header: 'Name' }, { key: 'amharic_name', header: 'Amharic name' },
              { key: 'actions', header: '', render: (d) => (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditingDept(d)}>Edit</Button>
                  <Button variant="danger" onClick={() => removeDept(d)}>Delete</Button>
                </div>
              ) },
            ]} rows={data.departments} empty="No departments yet" />
          </Card>
          <Card title="Teams">
            <form onSubmit={addTeam} className="mb-4 grid grid-cols-2 gap-2">
              <select required className="input" value={teamForm.department_id} onChange={(e) => setTeamForm({ ...teamForm, department_id: e.target.value })}>
                <option value="">Department…</option>
                {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input required placeholder="Team name" className="input" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
              <Button type="submit" loading={savingTeam} className="col-span-2" disabled={!data.departments.length}>Add team</Button>
            </form>
            <Table
              columns={[
                { key: 'name', header: 'Team' },
                { key: 'department', header: 'Department', render: (t) => data.departments.find((d) => d.id === t.department_id)?.name || '—' },
                { key: 'actions', header: '', render: (t) => (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditingTeam(t)}>Edit</Button>
                    <Button variant="danger" onClick={() => removeTeam(t)}>Delete</Button>
                  </div>
                ) },
              ]}
              rows={data.teams} empty="No teams yet"
            />
          </Card>
        </div>
      )}

      <EditZoneModal zone={editingZone} onClose={() => setEditingZone(null)} onSaved={reload} />
      <EditWoredaModal woreda={editingWoreda} zones={data.zones} onClose={() => setEditingWoreda(null)} onSaved={reload} />
      <EditDepartmentModal department={editingDept} onClose={() => setEditingDept(null)} onSaved={reload} />
      <EditTeamModal team={editingTeam} departments={data.departments} onClose={() => setEditingTeam(null)} onSaved={reload} />
    </>
  );
}
