import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import YearFormatSelect from '../../components/common/YearFormatSelect.jsx';
import MonthlyPlanCard from '../../components/plans/MonthlyPlanCard.jsx';
import ZoneMonthlyPlanCard from '../../components/plans/ZoneMonthlyPlanCard.jsx';
import ZoneTargetsTable from '../../components/plans/ZoneTargetsTable.jsx';
import { isAllValue, versionIdOf, wholeVersionOptions } from '../../utils/versionOptions.js';
import AllTeamsPlanCard from '../../components/plans/AllTeamsPlanCard.jsx';
import FeedbackPanel from '../../components/feedback/FeedbackPanel.jsx';
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
import { monthlyPlanTable, zoneMonthlyPlanTable, allTeamsPlanTable } from '../../utils/planTable.js';
import { MONTH_OPTIONS } from '../../utils/periods.js';
import { zoneMonthlyValues } from '../../utils/zoneMonthly.js';
import { PLAN_STATUS } from '../../components/plans/ZoneTargetsTable.jsx';
import { MONTHS, MONTH_NAMES, MONTH_NUMBERS, autoSplit, monthMap, monthsPayload, totalOf, valuesFromRows } from '../../utils/planSplit.js';

const CASCADED = ['submitted', 'approved'];
/** Value of the woreda select that stands for the zone itself. */
const ZONE = '__zone';
const ALL_TEAMS_ROLES = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_PLAN_EXPERT];

/**
 * Monthly plan. Pick a woreda whose annual plan has been cascaded; its annual targets are divided across the twelve
 * months — automatically (even split) or by hand — and then cascaded to the woreda (Zonal Expert / admin).
 * Pick "Zone plan" instead to see the zone's own plan month by month: the zone's annual targets against what its
 * woredas' monthly plans add up to. The other zonal roles (dept head, plan expert, team leader) see it read-only.
 */
export default function MonthlyPlanTab() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const [searchParams] = useSearchParams();
  const isAdmin = user.role === ROLES.ADMIN;
  const scoped = !isAdmin && user.department_id;
  const canEdit = isAdmin || user.role === ROLES.ZONAL_EXPERT; // everyone else only looks

  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: formats, loading: formatsLoading } = useFetch(
    () => reportFormatService.list({ status: 'approved', ...(scoped ? { department_id: user.department_id } : {}) }), []);

  const [formatId, setFormatId] = useState(searchParams.get('format_id') || '');
  const [year, setYear] = useState('');
  const [zoneId, setZoneId] = useState(user.zone_id || '');
  const [woredaId, setWoredaId] = useState(canEdit ? '' : ZONE);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverIssues, setServerIssues] = useState([]);

  const canAll = ALL_TEAMS_ROLES.includes(user.role);
  const allMode = canAll && isAllValue(formatId);
  const allVersionId = versionIdOf(formatId);
  const [allPeriod, setAllPeriod] = useState('annual'); // "All teams": 'annual', or 'm7' … a month of the plan year

  const format = useMemo(() => (formats || []).find((f) => String(f.id) === String(formatId)), [formats, formatId]);
  useEffect(() => { if (format) setYear(String(format.version_year)); setWoredaId(canEdit ? '' : ZONE); }, [format?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !allMode && !!formatId && !!year && (!isAdmin || !!zoneId);
  const allReady = allMode && !!year && (!isAdmin || !!zoneId);

  // "All teams": the latest approved revision of every active template of the year.
  const teamFormats = useMemo(() => {
    if (!allMode || !year) return [];
    const latest = new Map();
    for (const f of formats || []) {
      if (f.template_active === false || String(f.version_year) !== String(year) || String(f.version_id) !== allVersionId) continue;
      if (!latest.has(f.template_id) || f.version > latest.get(f.template_id).version) latest.set(f.template_id, f);
    }
    return [...latest.values()].sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '') || a.template_title.localeCompare(b.template_title));
  }, [allMode, formats, year, allVersionId]);
  const teamIdsKey = teamFormats.map((f) => f.id).join(',');
  const { data: allData, loading: allLoading } = useFetch(
    () => (allReady && teamFormats.length
      ? Promise.all([
        planService.list({ year }),
        planService.listMonthly({ year }),
        Promise.all(teamFormats.map((f) => planService.getZonePlan({ format_id: f.id, year, ...(isAdmin ? { zone_id: zoneId } : {}) }).catch(() => null))),
      ]).then(([annual, monthly, zonePlans]) => ({ annual, monthly, zonePlans }))
      : Promise.resolve(null)),
    [allReady, teamIdsKey, year, zoneId]);
  const { data: annualPlans, reload: reloadAnnual } = useFetch(
    () => (ready ? planService.list({ format_id: formatId, year }) : Promise.resolve([])), [formatId, year]);
  const { data: monthlyRows, reload: reloadMonthly } = useFetch(
    () => (ready ? planService.listMonthly({ format_id: formatId, year }) : Promise.resolve([])), [formatId, year]);
  const { data: zonePlan, loading: zoneLoading } = useFetch(
    () => (ready ? planService.getZonePlan({ format_id: formatId, year, ...(isAdmin ? { zone_id: zoneId } : {}) }) : Promise.resolve(null)), [formatId, year, zoneId, ready]);

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

  const isZone = woredaId === ZONE;
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
    setValues(rows.length ? valuesFromRows(rows, annualItems.map((i) => i.key)) : (canEdit ? autoSplit(items, parents, annualData) : {}));
  }, [woredaId, annual?.id, annual?.status, monthlyRows, formatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const STATUS_LABEL = { draft: 'Draft', submitted: 'Cascaded' };
  const zoneName = ref?.zones?.find((z) => z.zone_id === zoneId)?.name;
  const table = useMemo(() => (format && woreda && annualReady ? monthlyPlanTable({
    format, year, zoneName, woreda, statusLabel: STATUS_LABEL[status], items, annualData, values,
  }) : null), [format, year, zoneName, woreda, annualReady, status, items, annualData, values]); // eslint-disable-line react-hooks/exhaustive-deps

  // The zone's plan: its annual targets, and month by month what the woredas' cascaded monthly plans add up to.
  const zoneData = zonePlan?.data || {};
  const zoneView = useMemo(() => {
    if (!isZone || !format) return null;
    const { values: zoneValues, woredasCounted } = zoneMonthlyValues(items, monthlyRows || [], woredas.map((w) => w.woreda_id));
    return {
      values: zoneValues,
      woredaStates: woredas.map((w) => ({ woreda_id: w.woreda_id, name: w.name, state: stateOf(w.woreda_id) })),
      table: zoneMonthlyPlanTable({ format, year, zoneName, items, zoneData: zonePlan?.data || {}, values: zoneValues, woredasCounted, woredasTotal: woredas.length }),
      annualByWoreda: Object.fromEntries((annualPlans || []).filter((p) => woredas.some((w) => w.woreda_id === p.woreda_id)).map((p) => [p.woreda_id, p])),
    };
  }, [isZone, format, items, monthlyRows, annualPlans, woredas, zonePlan, year, zoneName]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const allTable = useMemo(() => {
    if (!allMode || !allData) return null;
    const zoneWoredas = (ref?.woredas || []).filter((w) => w.zone_id === zoneId);
    const ids = zoneWoredas.map((w) => w.woreda_id);
    const slot = allPeriod === 'annual' ? null : Number(allPeriod.slice(1));
    const blocks = teamFormats.map((f, i) => {
      const its = indicatorsOf(f.schema_definition);
      const byWoreda = {}; const states = {};
      let zone = {};
      if (!slot) {
        zone = allData.zonePlans[i]?.data || {};
        for (const w of zoneWoredas) {
          const p = allData.annual.find((x) => x.format_id === f.id && x.woreda_id === w.woreda_id);
          if (p && CASCADED.includes(p.status)) byWoreda[w.woreda_id] = p.data || {};
          states[w.woreda_id] = p ? (PLAN_STATUS[p.status]?.[0] || p.status) : 'not planned';
        }
      } else {
        const rows = allData.monthly.filter((x) => x.format_id === f.id);
        const { values } = zoneMonthlyValues(its, rows, ids);
        const idx = MONTH_NUMBERS.indexOf(slot);
        for (const it of its) { const v = values[it.key]?.[idx]; if (v !== '' && v !== undefined) zone[it.key] = Number(v); }
        for (const w of zoneWoredas) {
          const r = rows.find((x) => x.woreda_id === w.woreda_id && Number(x.month) === slot);
          if (r && CASCADED.includes(r.status)) byWoreda[w.woreda_id] = r.data || {};
          states[w.woreda_id] = r ? (CASCADED.includes(r.status) ? 'cascaded' : 'draft') : 'not planned';
        }
      }
      return { format: f, items: its, zone, byWoreda, states };
    });
    const label = slot ? `${MONTH_OPTIONS.find((m) => m.value === slot)?.label} monthly` : 'Annual';
    return allTeamsPlanTable({ year, periodLabel: label, zoneName: ref?.zones?.find((z) => z.zone_id === zoneId)?.name, woredas: zoneWoredas, blocks });
  }, [allMode, allData, allPeriod, teamFormats, ref, zoneId, year]);

  if (!ref || formatsLoading) return <Loader />;

  return (
    <>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400 print:hidden">
        {canEdit
          ? "A woreda's monthly plan divides its cascaded annual plan across the twelve months, July to June — let the system split it evenly, or set each month yourself. The months must add up to the annual plan. Choose Zone plan to see the zone's own plan month by month."
          : "The zone's plan month by month, and each woreda's monthly plan. The Zonal Expert prepares them; here you can only look."}
      </p>

      <Card title="Report format" className="mb-6 print:hidden">
        {!formats?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No approved report formats yet. <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/report-formats">Create one</Link> and have the Zonal Dept Head approve it first.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <YearFormatSelect
              formats={formats} year={year} setYear={setYear} formatId={formatId} setFormatId={setFormatId}
              idPrefix="plan" versionLabel="Approved format (version)" yearLabel="Plan year"
              allOptions={canAll ? wholeVersionOptions(formats, year) : undefined}
            />
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

      {allMode && allReady && (
        <div className="space-y-6">
          <Card title="Period" className="print:hidden">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label" htmlFor="all-period">Show</label>
                <select id="all-period" className="input" value={allPeriod} onChange={(e) => setAllPeriod(e.target.value)}>
                  <option value="annual">Annual plan</option>
                  <optgroup label="Monthly plan">{MONTH_OPTIONS.map((m) => <option key={m.value} value={`m${m.value}`}>{m.label}</option>)}</optgroup>
                </select>
              </div>
            </div>
          </Card>
          {allLoading ? <Loader /> : !teamFormats.length ? (
            <Card><p className="text-sm text-slate-500 dark:text-slate-400">There is no approved report format in this version for {year}.</p></Card>
          ) : allTable && (
            <AllTeamsPlanCard
              table={allTable} woredas={(ref.woredas || []).filter((w) => w.zone_id === zoneId)}
              title={`${allTable.versionName} — ${allPeriod === 'annual' ? 'annual plan' : `${MONTH_OPTIONS.find((m) => `m${m.value}` === allPeriod)?.label} plan`} ${year}`}
            />
          )}
          {!allLoading && !!teamFormats.length && (user.role === ROLES.ZONAL_DEPT_HEAD || isAdmin) && (
            <FeedbackPanel
              title="Department feedback on the zone plan" role={user.role}
              params={{ kind: 'department_plan', year: Number(year), period: allPeriod, department_id: teamFormats[0].department_id, zone_id: zoneId }}
              enabled={!!zoneId}
              note="Choose a zone to see or give the department feedback."
              hint="One feedback for the whole department — all teams at once, not one per team. There is no score."
            />
          )}
        </div>
      )}

      {format && !items.length && (
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">No item in this format has a measurement, so there is nothing to plan.</p></Card>
      )}

      {format && items.length > 0 && ready && (
        <div className="space-y-6">
          <Card title="Zone or woreda" className="print:hidden">
            {!woredas.length ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">There are no woredas in this zone yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor="monthly-woreda">Plan of</label>
                  <select id="monthly-woreda" className="input" value={woredaId} onChange={(e) => setWoredaId(e.target.value)}>
                    <option value="">Select…</option>
                    <option value={ZONE}>Zone plan — all woredas</option>
                    {woredas.map((w) => <option key={w.woreda_id} value={w.woreda_id}>{w.name} — {stateOf(w.woreda_id)}</option>)}
                  </select>
                </div>
              </div>
            )}
          </Card>

          {isZone && (zoneLoading ? <Loader /> : !zonePlan ? (
            <Card className="print:hidden">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                The zone plan for {year} hasn't been set yet.
                {canEdit && <> Set it in the <Link className="text-brand-600 hover:underline dark:text-brand-400" to={`/plans/cascade?tab=annual&format_id=${formatId}`}>Annual Plan</Link> tab first.</>}
              </p>
            </Card>
          ) : zoneView && (
            <>
              <ZoneMonthlyPlanCard items={items} zoneData={zoneData} values={zoneView.values} woredaStates={zoneView.woredaStates} table={zoneView.table} />
              <Card title="Annual targets — zone and woredas" className="print:hidden">
                <ZoneTargetsTable format={format} zoneData={zoneData} woredas={woredas} plans={zoneView.annualByWoreda} />
              </Card>
              <FeedbackPanel
                title="Feedback on the zone plan" role={user.role}
                params={{ kind: 'zone_plan', format_id: Number(formatId), year: Number(year), zone_id: zoneId }}
                hint="The zone expert and team leader of this team give feedback on the zone's plan. There is no score."
              />
            </>
          ))}

          {woreda && !annualReady && (
            <Card className="print:hidden">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {woreda.name}'s annual plan hasn't been cascaded yet, so there is nothing to divide.
                {canEdit && <> Cascade it from the{' '}
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to={`/plans/cascade?tab=annual&format_id=${formatId}`}>Annual Plan</Link> tab first.</>}
              </p>
            </Card>
          )}

          {woreda && annualReady && !canEdit && !rows.length && (
            <Card className="print:hidden">
              <p className="text-sm text-slate-500 dark:text-slate-400">{woreda.name}'s monthly plan hasn't been prepared yet.</p>
            </Card>
          )}

          {woreda && annualReady && (canEdit || rows.length > 0) && (
            <MonthlyPlanCard
              woreda={woreda} items={items} parents={parents} annualData={annualData}
              values={values} setValues={setValues} status={status} locked={locked}
              onDivide={() => setValues(autoSplit(items, parents, annualData))}
              onSave={save} saving={saving} serverIssues={serverIssues} blockers={blockers} table={table} readOnly={!canEdit}
            />
          )}

          {woreda && annualReady && (
            <FeedbackPanel
              title={`Feedback on ${woreda.name}'s plan`} role={user.role}
              params={{ kind: 'woreda_plan', format_id: Number(formatId), year: Number(year), woreda_id: woredaId }}
              hint="The zone expert and team leader of this team give feedback on this woreda's plan. There is no score."
            />
          )}
        </div>
      )}
    </>
  );
}
