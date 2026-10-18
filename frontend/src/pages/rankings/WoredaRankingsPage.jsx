import { useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Loader from '../../components/common/Loader.jsx';
import WoredaRankTable from '../../components/rankings/WoredaRankTable.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import { useWoredaRankings } from '../../hooks/useRankings.js';
import * as referenceService from '../../services/referenceService.js';
import { ROLES } from '../../utils/roleHelpers.js';

export default function WoredaRankingsPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodType, setPeriodType] = useState('annual');
  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: existing, loading, reload } = useWoredaRankings({ year, period_type: periodType });
  const woredas = (ref?.woredas || []).filter((w) => user.role === ROLES.ADMIN || w.zone_id === user.zone_id || w.woreda_id === user.woreda_id);
  const editable = [ROLES.ZONAL_PLAN_EXPERT, ROLES.ADMIN].includes(user.role);

  return (
    <>
      <Header title="Woreda rankings" subtitle={editable ? 'Assign the overall rank and feedback for each woreda.' : undefined} />
      <div className="mb-4 flex gap-3">
        <select className="input w-40" value={periodType} onChange={(e) => setPeriodType(e.target.value)}><option>annual</option><option>quarterly</option><option>monthly</option></select>
        <input type="number" className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>
      {loading || !ref ? <Loader /> : <WoredaRankTable key={`${year}-${periodType}-${existing?.length}`} woredas={woredas} existing={existing || []} year={year} periodType={periodType} editable={editable} onSaved={reload} />}
    </>
  );
}
