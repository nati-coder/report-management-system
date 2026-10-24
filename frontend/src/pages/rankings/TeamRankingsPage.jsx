import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Table from '../../components/common/Table.jsx';
import Loader from '../../components/common/Loader.jsx';
import Button from '../../components/common/Button.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import { useTeamRankings } from '../../hooks/useRankings.js';
import * as referenceService from '../../services/referenceService.js';
import * as rankingService from '../../services/rankingService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { isZonalUser, ROLES } from '../../utils/roleHelpers.js';
import { formatNumber } from '../../utils/formatters.js';

export default function TeamRankingsPage() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const { data: ref } = useFetch(() => referenceService.all(), []);
  const woredas = (ref?.woredas || []).filter((w) => !user.zone_id || w.zone_id === user.zone_id);
  const [f, setF] = useState({ woreda_id: user.woreda_id || '', period_type: 'monthly', year: new Date().getFullYear(), month: 1, quarter: 1 });
  const params = { woreda_id: f.woreda_id, period_type: f.period_type, year: f.year, ...(f.period_type === 'monthly' ? { month: f.month } : {}), ...(f.period_type === 'quarterly' ? { quarter: f.quarter } : {}) };
  const { data, loading, reload } = useTeamRankings(f.woreda_id ? params : { woreda_id: '', period_type: 'monthly', year: f.year });
  const teamName = (id) => ref?.teams.find((t) => t.id === id)?.name;
  const canCompute = isZonalUser(user) || user.role === ROLES.ADMIN;

  const compute = async () => {
    try { await rankingService.computeTeams(params); success('Ranking recomputed'); reload(); } catch (e) { error(errorMessage(e)); }
  };

  return (
    <>
      <Header title="Team rankings" subtitle="Timeliness 40% · Accuracy 30% · Quality 30%" actions={canCompute && <Button onClick={compute} disabled={!f.woreda_id}>Recompute</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        {!user.woreda_id && (
          <select className="input w-56" value={f.woreda_id} onChange={(e) => setF({ ...f, woreda_id: e.target.value })}>
            <option value="">Select woreda…</option>{woredas.map((w) => <option key={w.woreda_id} value={w.woreda_id}>{w.name}</option>)}
          </select>
        )}
        <select className="input w-36" value={f.period_type} onChange={(e) => setF({ ...f, period_type: e.target.value })}>
          <option>monthly</option><option>quarterly</option><option>annual</option>
        </select>
        <input type="number" className="input w-28" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} />
        {f.period_type === 'monthly' && <select className="input w-32" value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}>{MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>}
        {f.period_type === 'quarterly' && <input type="number" min="1" max="4" className="input w-24" value={f.quarter} onChange={(e) => setF({ ...f, quarter: Number(e.target.value) })} />}
      </div>
      {loading ? <Loader /> : <Table rows={f.woreda_id ? data : []} empty={f.woreda_id ? 'No ranking yet — recompute to generate.' : 'Select a woreda'}
        columns={[{ key: 'rank', header: 'Rank' }, { key: 'team', header: 'Team', render: (r) => r.team_name || teamName(r.team_id) }, { key: 'total_score', header: 'Score', render: (r) => formatNumber(r.total_score) }]} />}
    </>
  );
}
