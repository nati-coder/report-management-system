import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import RankFilters, { periodParams } from '../../components/rankings/RankFilters.jsx';
import WoredaOverallTable from '../../components/rankings/WoredaOverallTable.jsx';
import WoredaByTeamTable from '../../components/rankings/WoredaByTeamTable.jsx';
import ZonalTeamTable from '../../components/rankings/ZonalTeamTable.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as referenceService from '../../services/referenceService.js';
import * as rankService from '../../services/rankService.js';
import { ROLES } from '../../utils/roleHelpers.js';
import { currentFiscalYear } from '../../utils/periods.js';

const TABS = [{ id: 'woreda', label: 'Woreda Rank' }, { id: 'team', label: 'Team Rank' }];
const MODES = [{ id: 'overall', label: 'Overall (department)' }, { id: 'team', label: 'By team' }];
const EXPLAIN = {
  overall: 'Each woreda is ranked on the average achievement of all its teams.',
  team: 'Woredas are compared on one team’s achievement.',
  teams: 'Each team is ranked on its average achievement across the woredas of the zone.',
};

/** Rank: achievement rankings, computed live from the plans and reports. Two tabs: Woreda Rank and Team Rank. */
export default function RankPage() {
  const { user } = useAuth();
  const isAdmin = user.role === ROLES.ADMIN;
  const [search, setSearch] = useSearchParams();
  const tab = TABS.some((t) => t.id === search.get('tab')) ? search.get('tab') : 'woreda';
  const setTab = (id) => setSearch({ tab: id }, { replace: true });
  const [mode, setMode] = useState('overall');
  const [f, setF] = useState({ year: currentFiscalYear(), period: 'annual', zoneId: '', departmentId: '', teamId: '', cap: false });

  const { data: ref } = useFetch(() => referenceService.all(), []);
  // the admin chooses the zone and department (start with the first of each); everyone else is held to their own on the server
  useEffect(() => {
    if (!ref || !isAdmin) return;
    setF((x) => ({ ...x, zoneId: x.zoneId || ref.zones?.[0]?.zone_id || '', departmentId: x.departmentId || String(ref.departments?.[0]?.id ?? '') }));
  }, [ref, isAdmin]);

  const deptId = isAdmin ? Number(f.departmentId) : user.department_id;
  const teams = useMemo(() => (ref?.teams || []).filter((t) => t.department_id === deptId), [ref, deptId]);
  const teamId = teams.some((t) => String(t.id) === String(f.teamId)) ? f.teamId : String(teams[0]?.id ?? '');
  const ready = !!ref && (!isAdmin || (f.zoneId && f.departmentId)) && (tab === 'team' || mode === 'overall' || !!teamId);

  const params = {
    year: f.year, ...periodParams(f.period), ...(f.cap ? { cap: 100 } : {}),
    ...(isAdmin ? { zone_id: f.zoneId, department_id: f.departmentId } : {}),
  };
  const woredaParams = { ...params, mode, ...(mode === 'team' ? { team_id: teamId } : {}) };
  const { data, loading, error } = useFetch(
    () => (!ready ? Promise.resolve(null) : tab === 'woreda' ? rankService.woredaRank(woredaParams) : rankService.teamRank(params)),
    [ready, tab, mode, JSON.stringify(tab === 'woreda' ? woredaParams : params)],
  );

  // the result held while a new one loads belongs to the previous tab / mode: show it only when it is the view asked for
  const view = tab === 'team' ? 'teams' : mode;
  const current = data && data.mode === view ? data : null;

  const scopeText = !isAdmin && ref ? [ref.zones?.find((z) => z.zone_id === user.zone_id)?.name, ref.departments?.find((d) => d.id === user.department_id)?.name].filter(Boolean).join(' · ') : '';
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    setTab(TABS[(TABS.findIndex((t) => t.id === tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id);
  };

  return (
    <>
      <Header title="Rank" subtitle="Achievement = what was reported against what was planned. Combined achievements are averaged, never added." />
      <div role="tablist" aria-label="Rank" className="mb-5 flex gap-1 border-b border-slate-200 dark:border-slate-700" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="rank-panel" tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="rank-panel" aria-labelledby={`tab-${tab}`}>
        <RankFilters value={f} onChange={setF} isAdmin={isAdmin} zones={ref?.zones || []} departments={ref?.departments || []} scopeText={scopeText}>
          {tab === 'woreda' && (
            <>
              <div className="pb-0.5">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Rank by</span>
                <div role="group" aria-label="Rank woredas by" className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                  {MODES.map((m) => (
                    <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}
                      className={`px-3 py-2 text-sm ${mode === m.id ? 'bg-brand-600 font-medium text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {mode === 'team' && (
                <label><span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Team</span>
                  <select className="input w-48" value={teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })}>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              )}
            </>
          )}
        </RankFilters>

        <Card title={tab === 'team' ? 'Team standings' : mode === 'overall' ? 'Woreda standings' : 'Woreda standings by team'}>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{tab === 'team' ? EXPLAIN.teams : EXPLAIN[mode]} Items with no report count as 0%.</p>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!ready ? <p className="text-sm text-slate-500 dark:text-slate-400">Choose a zone and department to see the ranking.</p>
            : loading || !current ? <Loader />
              : !current.rows.length ? <p className="text-sm text-slate-500 dark:text-slate-400">Nothing to rank yet for this selection.</p>
                : view === 'teams' ? <ZonalTeamTable rows={current.rows} />
                  : view === 'team' ? <WoredaByTeamTable rows={current.rows} /> : <WoredaOverallTable rows={current.rows} />}
        </Card>
      </div>
    </>
  );
}
