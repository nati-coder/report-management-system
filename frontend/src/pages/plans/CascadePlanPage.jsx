import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import ZonePlanCard from '../../components/plans/ZonePlanCard.jsx';
import WoredaPlanCard from '../../components/plans/WoredaPlanCard.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as planService from '../../services/planService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { indicatorsOf } from '../../utils/formatTree.js';
import { hierarchyOf, hierarchyIssues, toNumbers, EPS } from '../../utils/planChecks.js';
import { annualCascadeTable } from '../../utils/planTable.js';

const asStrings = (data) => Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)]));
const sameNumbers = (a, b) => {
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => b[k] !== undefined && Math.abs(a[k] - b[k]) <= EPS);
};

/**
 * Zonal Expert: annual plan, in two steps.
 *   1. Save the zone plan — the zone's target for each measured item (parents = sum of sub-items).
 *   2. Plan the woredas one at a time (chosen from a combo box) against it: their totals must add up to
 *      the zone plan, and each woreda's parents must equal the sum of their sub-items.
 */
export default function AnnualPlanTab() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const [searchParams] = useSearchParams();
  const isAdmin = user.role === ROLES.ADMIN;
  const scoped = !isAdmin && user.department_id;

  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: formats, loading: formatsLoading } = useFetch(
    () => reportFormatService.list({ status: 'approved', ...(scoped ? { department_id: user.department_id } : {}) }), []);

  const [formatId, setFormatId] = useState(searchParams.get('format_id') || '');
  const [year, setYear] = useState('');
  const [zoneId, setZoneId] = useState(user.zone_id || '');
  const [zoneVals, setZoneVals] = useState({});
  const [woredaId, setWoredaId] = useState('');
  const [woredaVals, setWoredaVals] = useState({});
  const [savingZone, setSavingZone] = useState(false);
  const [savingWoreda, setSavingWoreda] = useState(false);
  const [zoneIssues, setZoneIssues] = useState([]);
  const [woredaIssues, setWoredaIssues] = useState([]);

  const format = useMemo(() => (formats || []).find((f) => String(f.id) === String(formatId)), [formats, formatId]);
  useEffect(() => { if (format) setYear(String(format.version_year)); setWoredaId(''); }, [format?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!formatId && !!year && (!isAdmin || !!zoneId);
  const { data: zonePlan, reload: reloadZone } = useFetch(
    () => (ready ? planService.getZonePlan({ format_id: formatId, year, ...(isAdmin ? { zone_id: zoneId } : {}) }) : Promise.resolve(null)), [formatId, year, zoneId]);
  const { data: allPlans, reload: reloadPlans } = useFetch(
    () => (formatId && year ? planService.list({ format_id: formatId, year }) : Promise.resolve([])), [formatId, year]);

  const woredas = useMemo(() => (ref?.woredas || []).filter((w) => w.zone_id === zoneId), [ref, zoneId]);
  const plans = useMemo(() => (allPlans || []).filter((p) => woredas.some((w) => w.woreda_id === p.woreda_id)), [allPlans, woredas]);
  const items = useMemo(() => indicatorsOf(format?.schema_definition), [format]);
  const parents = useMemo(() => hierarchyOf(format?.schema_definition), [format]);

  // Load saved values into the two forms.
  useEffect(() => { setZoneVals(asStrings(zonePlan?.data)); setZoneIssues([]); }, [zonePlan, formatId, year, zoneId]);
  useEffect(() => {
    const p = plans.find((x) => x.woreda_id === woredaId);
    setWoredaVals(asStrings(p?.data)); setWoredaIssues([]);
  }, [woredaId, allPlans]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoneNums = toNumbers(zoneVals);
  const dirty = !!zonePlan && !sameNumbers(zoneNums, zonePlan.data || {});
  const cascadedCount = plans.filter((p) => ['submitted', 'approved'].includes(p.status)).length;
  // The one table of the cascade — what is on screen, including what is being typed — for Excel / CSV / Print.
  const table = useMemo(() => (format && zonePlan ? annualCascadeTable({
    format, year, zoneName: ref?.zones?.find((z) => z.zone_id === zoneId)?.name, items, zoneData: zonePlan.data || {}, woredas, plans,
    live: woredaId ? { woredaId, nums: toNumbers(woredaVals) } : null,
  }) : null), [format, year, zonePlan, items, woredas, plans, ref, zoneId, woredaId, woredaVals]);

  /** Client-side checks shared by both steps; returns an error message or null. */
  const firstProblem = (nums) => {
    for (const [k, v] of Object.entries(nums)) {
      const it = items.find((x) => x.key === k);
      if (!it) continue;
      if (v < 0) return `${it.label}: a target can't be negative`;
      if (it.isPercent && v > 100) return `${it.label}: a percentage must be between 0 and 100`;
    }
    return null;
  };

  const saveZone = async () => {
    setZoneIssues([]);
    if (!Object.keys(zoneNums).length) return error('Enter at least one zone target first');
    const bad = firstProblem(zoneNums);
    if (bad) return error(bad);
    const issues = hierarchyIssues(parents, zoneNums);
    const key = Object.keys(issues)[0];
    if (key) return error(`${items.find((i) => i.key === key).label} ${issues[key]}`);

    setSavingZone(true);
    try {
      await planService.saveZonePlan({ format_id: Number(formatId), year: Number(year), data: zoneNums, ...(isAdmin ? { zone_id: zoneId } : {}) });
      success('Zone plan saved');
      reloadZone();
    } catch (err) {
      if (Array.isArray(err.response?.data?.details)) setZoneIssues(err.response.data.details);
      error(errorMessage(err));
    } finally { setSavingZone(false); }
  };

  const saveWoreda = async (submit) => {
    setWoredaIssues([]);
    const woreda = woredas.find((w) => w.woreda_id === woredaId);
    const nums = Object.fromEntries(Object.entries(toNumbers(woredaVals)).filter(([k]) => zonePlan?.data?.[k] !== undefined));
    if (!Object.keys(nums).length && !plans.some((p) => p.woreda_id === woredaId)) return error('Enter at least one target first');
    const bad = firstProblem(nums);
    if (bad) return error(bad);
    if (submit && !window.confirm(`Cascade ${woreda.name}'s ${year} plan? They will be notified and it can't be changed afterwards.`)) return;

    setSavingWoreda(true);
    try {
      await planService.cascade({ format_id: Number(formatId), year: Number(year), submit, allocations: [{ woreda_id: woredaId, data: nums }] });
      success(submit ? `Cascaded to ${woreda.name}` : `Saved ${woreda.name}'s draft`);
      reloadPlans();
      if (submit) reloadZone();
    } catch (err) {
      if (Array.isArray(err.response?.data?.details)) setWoredaIssues(err.response.data.details);
      error(errorMessage(err));
    } finally { setSavingWoreda(false); }
  };

  if (!ref || formatsLoading) return <Loader />;

  return (
    <>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400 print:hidden">
        First set the zone plan, then plan each woreda against it. Woreda totals must add up to the zone plan, and every parent must equal the sum of its sub-items.
      </p>

      <Card title="Report format" className="mb-6 print:hidden">
        {!formats?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No approved report formats yet. <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/report-formats">Create one</Link> and have the Zonal Dept Head approve it first.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="label">Approved format</label>
              <select className="input" value={formatId} onChange={(e) => setFormatId(e.target.value)}>
                <option value="">Select…</option>
                {formats.map((f) => <option key={f.id} value={f.id}>{f.template_title} — {f.version_name} · {f.team_name} (v{f.version})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Plan year</label>
              <input type="number" className="input" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            {isAdmin && (
              <div>
                <label className="label">Zone</label>
                <select className="input" value={zoneId} onChange={(e) => { setZoneId(e.target.value); setWoredaId(''); }}>
                  <option value="">Select…</option>
                  {ref.zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </Card>

      {format && !items.length && (
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">No item in this format has a measurement, so there is nothing to plan.</p></Card>
      )}

      {format && items.length > 0 && ready && (
        <div className="space-y-6">
          <div className="print:hidden">
            <ZonePlanCard
              items={items} parents={parents} values={zoneVals} setValues={setZoneVals}
              saved={!!zonePlan} dirty={dirty} onSave={saveZone} saving={savingZone}
              cascadedCount={cascadedCount} serverIssues={zoneIssues}
            />
          </div>
          {!zonePlan ? (
            <Card title="Step 2 — Woreda plans" className="print:hidden">
              <p className="text-sm text-slate-500 dark:text-slate-400">Save the zone plan first — woredas are planned against it.</p>
            </Card>
          ) : !woredas.length ? (
            <Card title="Step 2 — Woreda plans" className="print:hidden"><p className="text-sm text-slate-500 dark:text-slate-400">There are no woredas in this zone yet.</p></Card>
          ) : (
            <WoredaPlanCard
              items={items} parents={parents} zoneData={zonePlan.data} woredas={woredas} plans={plans}
              woredaId={woredaId} setWoredaId={setWoredaId} values={woredaVals} setValues={setWoredaVals}
              onSave={saveWoreda} saving={savingWoreda} serverIssues={woredaIssues} table={table}
            />
          )}
        </div>
      )}
    </>
  );
}
