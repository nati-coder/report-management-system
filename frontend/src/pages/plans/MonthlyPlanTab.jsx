import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import MonthlyPlanCard from '../../components/plans/MonthlyPlanCard.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as planService from '../../services/planService.js';
import * as referenceService from '../../services/referenceService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { indicatorsOf } from '../../utils/formatTree.js';
import { hierarchyOf, hierarchyIssues, fmt } from '../../utils/planChecks.js';
import { monthlyPlanTable } from '../../utils/planTable.js';
import { MONTHS, MONTH_NAMES, autoSplit, monthMap, monthsPayload, totalOf, valuesFromRows } from '../../utils/planSplit.js';

const CASCADED = ['submitted', 'approved'];

/**
 * Zonal Expert: monthly plan. Pick a woreda whose annual plan has been cascaded; its annual targets are divided
 * across the twelve months — automatically (even split) or by hand — and then cascaded to the woreda.
 */
export default function MonthlyPlanTab() {
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
  const [woredaId, setWoredaId] = useState('');
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverIssues, setServerIssues] = useState([]);

  const format = useMemo(() => (formats || []).find((f) => String(f.id) === String(formatId)), [formats, formatId]);
  useEffect(() => { if (format) setYear(String(format.version_year)); setWoredaId(''); }, [format?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!formatId && !!year && (!isAdmin || !!zoneId);
  const { data: annualPlans, reload: reloadAnnual } = useFetch(
    () => (ready ? planService.list({ format_id: formatId, year }) : Promise.resolve([])), [formatId, year]);
  const { data: monthlyRows, reload: reloadMonthly } = useFetch(
    () => (ready ? planService.listMonthly({ format_id: formatId, year }) : Promise.resolve([])), [formatId, year]);

  const woredas = useMemo(() => (ref?.woredas || []).filter((w) => w.zone_id === zoneId), [ref, zoneId]);
  const items = useMemo(() => indicatorsOf(format?.schema_definition), [format]);
  const parents = useMemo(() => hierarchyOf(format?.schema_definition), [format]);

  const annualOf = (id) => (annualPlans || []).find((p) => p.woreda_id === id);
  const rowsOf = (id) => (monthlyRows || []).filter((r) => r.woreda_id === id);
  const stateOf = (id) => {
    const a = annualOf(id);
    if (!a || !CASCADED.includes(a.status)) return 'annual plan not cascaded';
    const rows = rowsOf(id);
    if (!rows.length) return 'not started';
    return rows.every((r) => CASCADED.includes(r.status)) ? 'cascaded' : 'draft';
  };

  const woreda = woredas.find((w) => w.woreda_id === woredaId);
  const annual = woreda ? annualOf(woredaId) : null;
  const annualReady = !!annual && CASCADED.includes(annual.status);
  const rows = woreda ? rowsOf(woredaId) : [];
  const status = rows.length ? (rows.every((r) => CASCADED.includes(r.status)) ? 'submitted' : 'draft') : null;
  const locked = status === 'submitted';
  const annualData = annual?.data || {};
  const annualItems = items.filter((it) => annualData[it.key] !== undefined);

  // Load the saved months; with nothing saved yet, start from the automatic even split.
  useEffect(() => {
    setServerIssues([]);
    if (!annualReady) { setValues({}); return; }
    setValues(rows.length ? valuesFromRows(rows, annualItems.map((i) => i.key)) : autoSplit(items, parents, annualData));
  }, [woredaId, annual?.id, annual?.status, monthlyRows, formatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const STATUS_LABEL = { draft: 'Draft', submitted: 'Cascaded' };
  const zoneName = ref?.zones?.find((z) => z.zone_id === zoneId)?.name;
  const table = useMemo(() => (format && woreda && annualReady ? monthlyPlanTable({
    format, year, zoneName, woreda, statusLabel: STATUS_LABEL[status], items, annualData, values,
  }) : null), [format, year, zoneName, woreda, annualReady, status, items, annualData, values]); // eslint-disable-line react-hooks/exhaustive-deps

  // Everything that stops this monthly plan being cascaded right now.
  const blockers = [];
  if (annualReady) {
    for (const it of annualItems) {
      if (it.isPercent) continue;
      const left = Math.round((annualData[it.key] - totalOf(values[it.key])) * 100) / 100;
      if (left > 0.005) blockers.push(`${it.label}: ${fmt(left)} of the annual plan is not placed in a month yet`);
      if (left < -0.005) blockers.push(`${it.label}: ${fmt(-left)} more than the annual plan`);
    }
    for (let m = 0; m < MONTHS; m += 1) {
      const nums = Object.fromEntries(Object.entries(monthMap(values, m)).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
      for (const [k, msg] of Object.entries(hierarchyIssues(parents, nums))) blockers.push(`${MONTH_NAMES[m]}: ${annualItems.find((i) => i.key === k)?.label ?? k} ${msg}`);
    }
    for (const it of annualItems) {
      if (!it.isPercent) continue;
      if ((values[it.key] || []).some((v) => v !== '' && (Number(v) < 0 || Number(v) > 100))) blockers.push(`${it.label}: a percentage must be between 0 and 100`);
    }
  }

  const save = async (submit) => {
    setServerIssues([]);
    if ((values && Object.values(values).flat().some((v) => v !== '' && Number(v) < 0))) return error("A target can't be negative");
    if (submit && !window.confirm(`Cascade ${woreda.name}'s ${year} monthly plan? They will be notified and it can't be changed afterwards.`)) return;
    setSaving(true);
    try {
      await planService.saveMonthly({ format_id: Number(formatId), year: Number(year), woreda_id: woredaId, submit, months: monthsPayload(values) });
      success(submit ? `Monthly plan cascaded to ${woreda.name}` : `Saved ${woreda.name}'s monthly draft`);
      reloadMonthly(); reloadAnnual();
    } catch (err) {
      if (Array.isArray(err.response?.data?.details)) setServerIssues(err.response.data.details);
      error(errorMessage(err));
    } finally { setSaving(false); }
  };

  if (!ref || formatsLoading) return <Loader />;

  return (
    <>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400 print:hidden">
        A woreda's monthly plan divides its cascaded annual plan across the twelve months, July to June — let the system split it evenly, or set each month yourself. The months must add up to the annual plan.
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
          <Card title="Woreda" className="print:hidden">
            {!woredas.length ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">There are no woredas in this zone yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor="monthly-woreda">Woreda</label>
                  <select id="monthly-woreda" className="input" value={woredaId} onChange={(e) => setWoredaId(e.target.value)}>
                    <option value="">Select a woreda…</option>
                    {woredas.map((w) => <option key={w.woreda_id} value={w.woreda_id}>{w.name} — {stateOf(w.woreda_id)}</option>)}
                  </select>
                </div>
              </div>
            )}
          </Card>

          {woreda && !annualReady && (
            <Card className="print:hidden">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {woreda.name}'s annual plan hasn't been cascaded yet, so there is nothing to divide. Cascade it from the{' '}
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to={`/plans/cascade?tab=annual&format_id=${formatId}`}>Annual Plan</Link> tab first.
              </p>
            </Card>
          )}

          {woreda && annualReady && (
            <MonthlyPlanCard
              woreda={woreda} items={items} parents={parents} annualData={annualData}
              values={values} setValues={setValues} status={status} locked={locked}
              onDivide={() => setValues(autoSplit(items, parents, annualData))}
              onSave={save} saving={saving} serverIssues={serverIssues} blockers={blockers} table={table}
            />
          )}
        </div>
      )}
    </>
  );
}
