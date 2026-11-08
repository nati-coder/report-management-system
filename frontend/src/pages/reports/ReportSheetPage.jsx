import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import { TableActions, PrintHeader, PRINT_CARD } from '../../components/plans/TableActions.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as reportService from '../../services/reportService.js';
import * as referenceService from '../../services/referenceService.js';
import { ROLES } from '../../utils/roleHelpers.js';
import { indicatorsOf } from '../../utils/formatTree.js';
import { fmt } from '../../utils/planChecks.js';
import { MONTH_OPTIONS, RANGE_OPTIONS, availablePeriods, currentFiscalYear, filedMonthly } from '../../utils/periods.js';
import { reportSheetTable, allTeamsReportTable } from '../../utils/planTable.js';
import ReportTabs from '../../components/reports/ReportTabs.jsx';
import YearFormatSelect from '../../components/common/YearFormatSelect.jsx';
import { isAllValue, versionIdOf, wholeVersionOptions } from '../../utils/versionOptions.js';
import FeedbackPanel from '../../components/feedback/FeedbackPanel.jsx';

const H = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
const D = 'border border-slate-300 px-2 py-1.5 text-right tabular-nums dark:border-slate-600';
const REPORT_TONE = { muted: 'font-normal text-slate-400', submitted: 'text-blue-600 dark:text-blue-400', reviewing: 'text-amber-600 dark:text-amber-400', approved: 'text-emerald-600 dark:text-emerald-400', rejected: 'text-red-600 dark:text-red-400' };

/** Roles that work across the teams of a department (the admin across all of them): they may see every team's report in one view. */
const ALL_TEAMS_ROLES = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_PLAN_EXPERT];

/**
 * The all-woredas sheet as one table: a Plan and a Report column per woreda, all-woredas totals and the share of the plan
 * reached first. A single format has its items and a Status row; "All teams" has the same for every team in the SAME
 * table, each team under its own heading row. `link` turns the woreda names into links to their report (one format only).
 */
function SheetCard({ woredas, table, title, isRange, link, className }) {
  const hasRows = table.rows.some((r) => r.kind === 'item');
  const span = 6 + woredas.length * 2;
  return (
    <Card title={title} className={className} actions={<TableActions table={table} disabled={!hasRows} />}>
      <PrintHeader table={table} />
      {!woredas.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">There are no woredas in scope.</p>
      ) : !hasRows ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No woreda has a plan or a submitted report for this yet.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="plan-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                <th rowSpan={2} className={`${H} sticky left-0 z-10 bg-slate-100 dark:bg-slate-900`}>Item</th>
                <th rowSpan={2} className={H}>Measurement</th>
                <th colSpan={3} className={`${H} bg-slate-200 text-center dark:bg-slate-800`}>All woredas</th>
                {woredas.map((w) => (
                  <th key={w.woreda_id} colSpan={2} className={`${H} text-center`}>
                    {link && w.report?.id ? <Link to={`/reports/${w.report.id}`} className="hover:underline print:no-underline">{w.name}</Link> : w.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                {['Plan', 'Report', 'Achieved'].map((c) => <th key={c} className={`${H} bg-slate-200 text-right dark:bg-slate-800`}>{c}</th>)}
                {woredas.map((w) => ['Plan', 'Report'].map((c) => <th key={`${w.woreda_id}-${c}`} className={`${H} text-right`}>{c}</th>))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => {
                if (r.kind === 'status') {
                  return (
                    <tr key={ri} className="bg-slate-50 font-semibold dark:bg-slate-900/40">
                      <td className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">Status</td>
                      <td className={H} /><td className={D} colSpan={3} />
                      {r.statuses.map((st, i) => [
                        <td key={`${i}-sp`} className={`${D} text-xs font-normal`}>{st.plan}</td>,
                        <td key={`${i}-sr`} className={`${D} text-xs ${st.report.tone === 'muted' ? REPORT_TONE.muted : REPORT_TONE[st.report.tone] || ''}`}>
                          {!link && st.reportId ? <Link to={`/reports/${st.reportId}`} className="hover:underline print:no-underline">{st.report.text}</Link> : st.report.text}
                        </td>,
                      ])}
                    </tr>
                  );
                }
                const pct = r.percent ? '%' : '';
                return (
                  <tr key={ri}>
                    <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" style={{ paddingLeft: 8 + Math.min(r.depth, 6) * 14 }}>
                      <span className="mr-2 font-mono text-xs text-slate-400">{r.cells[0]}</span>{r.cells[1]}
                    </td>
                    <td className={`${H} font-normal`}>{r.cells[2]}</td>
                    {[3, 4].map((i) => <td key={i} className={`${D} bg-slate-50 font-medium dark:bg-slate-900/40`}>{typeof r.cells[i] === 'number' ? fmt(r.cells[i]) : '—'}</td>)}
                    <td className={`${D} bg-slate-50 text-xs dark:bg-slate-900/40`}>{typeof r.cells[5] === 'number' ? `${fmt(r.cells[5])}%` : '—'}</td>
                    {woredas.map((w, wi) => {
                      const plan = r.cells[6 + wi * 2];
                      const rep = r.cells[7 + wi * 2];
                      return [
                        <td key={`${w.woreda_id}-p`} className={D}>{typeof plan === 'number' ? `${fmt(plan)}${pct}` : '—'}</td>,
                        <td key={`${w.woreda_id}-r`} className={`${D} font-semibold`}>{typeof rep === 'number' ? `${fmt(rep)}${pct}` : '—'}</td>,
                      ];
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 print:hidden">
        {isRange
          ? 'A summary adds up the monthly reports of its months (percentages are rates, so they are averaged) and sets them against the monthly plans of the same months. The status row shows how many of its months each woreda has reported.'
          : "Plan is the woreda's accepted annual plan (for a monthly report, that month's plan once it is cascaded). Submitted, in-review and approved reports are counted in the totals; percentages are rates, so they aren't added up."}
        {link ? " Click a woreda's name to open its report." : ' Click a status to open that woreda\'s report.'}
      </p>
    </Card>
  );
}

/**
 * Zone level users and the admin: every woreda's report for one format and period on a single sheet. Per woreda a
 * Plan and a Report column sit side by side, with all-woredas totals and the share of the plan reached first.
 * The zonal plan expert, the zonal dept head and the admin (who work across teams) can also pick "All teams":
 * then every team's sheet for the same period is stacked in one view. Downloadable as Excel / CSV and printable.
 *
 * The period list only offers periods that have started and that have reports (see availablePeriods): months up
 * to the latest reported one, and the quarters / half years / year that cover them.
 */
export default function ReportSheetPage() {
  const { user } = useAuth();
  const isAdmin = user.role === ROLES.ADMIN;
  const canAll = ALL_TEAMS_ROLES.includes(user.role);
  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: formats, loading: formatsLoading } = useFetch(() => reportFormatService.list({ status: 'approved' }), []);

  const [year, setYear] = useState('');             // chosen first …
  const [formatId, setFormatId] = useState('');      // … then the version (a format of that year), or ALL
  const [departmentId, setDepartmentId] = useState('');  // admin only, with "All teams": limit to one department
  const [period, setPeriod] = useState('');   // monthly formats: 'm7' (a month) or q1…q4 / h1 / h2 / annual (summed up from the months)
  const [quarter, setQuarter] = useState('');
  const [zoneId, setZoneId] = useState('');

  const allMode = canAll && isAllValue(formatId);
  const allVersionId = versionIdOf(formatId);
  const chosen = useMemo(() => (formats || []).find((f) => String(f.id) === String(formatId)), [formats, formatId]);
  const type = allMode ? 'monthly' : (chosen?.template_type === 'annual' ? 'monthly' : chosen?.template_type); // an annual format is reported month by month

  useEffect(() => { setPeriod(''); setQuarter(''); }, [formatId, year]);

  // "All teams": the latest approved revision of every active, monthly-reported template of the year (admin: of the chosen department).
  const teamFormats = useMemo(() => {
    if (!allMode || !year) return [];
    const latest = new Map();
    for (const f of formats || []) {
      if (!filedMonthly(f.template_type) || f.template_active === false || String(f.version_year) !== String(year) || String(f.version_id) !== allVersionId) continue;
      if (isAdmin && departmentId && String(f.department_id) !== String(departmentId)) continue;
      if (!latest.has(f.template_id) || f.version > latest.get(f.template_id).version) latest.set(f.template_id, f);
    }
    return [...latest.values()].sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '') || a.template_title.localeCompare(b.template_title));
  }, [allMode, formats, year, isAdmin, departmentId, allVersionId]);
  const sheetFormats = allMode ? teamFormats : (chosen ? [chosen] : []);
  const yearHasMonthly = (formats || []).some((f) => filedMonthly(f.template_type) && String(f.version_year) === String(year));
  const idsKey = sheetFormats.map((f) => f.id).join(',');

  // Which months of this year have a submitted report → the periods worth offering.
  const { data: reported } = useFetch(
    () => (type === 'monthly' && year && idsKey ? reportService.sheetMonths({ format_ids: idsKey, year, ...(isAdmin && zoneId ? { zone_id: zoneId } : {}) }) : Promise.resolve(null)),
    [type, year, idsKey, zoneId]);
  const periods = useMemo(() => availablePeriods({ year, reportedMonths: reported?.months || [] }), [year, reported]);
  useEffect(() => { // a choice that is no longer on offer (another year, another format) is dropped
    if (!period) return;
    const ok = period.startsWith('m') ? periods.months.some((m) => `m${m.value}` === period) : periods.ranges.some((r) => r.value === period);
    if (!ok) setPeriod('');
  }, [periods]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRange = type === 'monthly' && period && !period.startsWith('m');
  const month = type === 'monthly' && period.startsWith('m') ? period.slice(1) : '';
  const ready = sheetFormats.length > 0 && !!year && (type !== 'monthly' || !!period) && (type !== 'quarterly' || !!quarter);
  const { data: sheets, loading, error } = useFetch(
    () => (ready
      ? Promise.all(sheetFormats.map((f) => reportService.sheet({ format_id: f.id, year, ...(type === 'monthly' ? (isRange ? { range: period } : { month }) : {}), ...(type === 'quarterly' ? { quarter } : {}), ...(isAdmin && zoneId ? { zone_id: zoneId } : {}) })))
      : Promise.resolve(null)),
    [idsKey, year, period, quarter, zoneId, ready]);

  const periodLabel = type === 'monthly' && month ? MONTH_OPTIONS.find((m) => String(m.value) === month)?.label : isRange ? RANGE_OPTIONS.find((r) => r.value === period)?.label : type === 'quarterly' && quarter ? `Q${quarter}` : '';
  const zoneName = isAdmin ? ref?.zones?.find((z) => z.zone_id === zoneId)?.name : ref?.zones?.find((z) => z.zone_id === user.zone_id)?.name;
  // One table: "All teams" puts every team's rows in the same table; a single format is its own table.
  const table = useMemo(() => {
    if (!sheets?.length) return null;
    if (allMode) return allTeamsReportTable({ year, periodLabel, zoneName, sheets, isSummary: !!isRange });
    const sheet = sheets[0];
    return reportSheetTable({ format: sheet.format, year, periodLabel, zoneName, items: indicatorsOf(sheet.format?.schema_definition), woredas: sheet.woredas, isSummary: !!isRange });
  }, [sheets, allMode, year, periodLabel, zoneName, isRange]);
  const woredaCols = sheets?.[0]?.woredas || [];

  if (!ref || formatsLoading) return <Loader />;
  const canPickAll = canAll && yearHasMonthly;
  const isDeptHead = user.role === ROLES.ZONAL_DEPT_HEAD;
  const feedbackParams = { kind: 'department_report', year: Number(year), period, ...(isAdmin ? { department_id: departmentId, zone_id: zoneId } : {}) };
  const feedbackReady = allMode && !!period && (!isAdmin || (!!departmentId && !!zoneId));

  return (
    <>
      <div className="print:hidden">
        <Header title="All woredas' reports" subtitle={allMode ? "Every team's plan and report in every woreda, on one page." : "Every woreda's plan and report on one sheet — for a month, or summed up for a quarter, half year or the year."} />
        <ReportTabs />
        <Card title="Report" className="mb-6">
          {!formats?.length ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">There are no approved report formats yet.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <YearFormatSelect
                  formats={formats} year={year} setYear={setYear} formatId={formatId} setFormatId={setFormatId} idPrefix="sheet"
                  allOptions={canPickAll ? wholeVersionOptions((formats || []).filter((f) => filedMonthly(f.template_type)), year) : undefined}
                />
                {type === 'monthly' && (
                  <div>
                    <label className="label" htmlFor="sheet-period">Period</label>
                    <select id="sheet-period" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                      <option value="">Select…</option>
                      {periods.months.length > 0 && <optgroup label="Month">{periods.months.map((m) => <option key={m.value} value={`m${m.value}`}>{m.label}</option>)}</optgroup>}
                      {periods.ranges.length > 0 && <optgroup label="Summed up from the months">{periods.ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</optgroup>}
                    </select>
                  </div>
                )}
                {type === 'quarterly' && (
                  <div>
                    <label className="label" htmlFor="sheet-quarter">Quarter</label>
                    <select id="sheet-quarter" className="input" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                      <option value="">Select…</option>
                      {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                    </select>
                  </div>
                )}
                {allMode && isAdmin && (
                  <div>
                    <label className="label" htmlFor="sheet-department">Department</label>
                    <select id="sheet-department" className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                      <option value="">All departments</option>
                      {(ref.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {isAdmin && (
                  <div>
                    <label className="label" htmlFor="sheet-zone">Zone</label>
                    <select id="sheet-zone" className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                      <option value="">All zones</option>
                      {ref.zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {type === 'monthly' && !!year && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {periods.months.length
                    ? `Only periods that have started and have reports are listed — up to ${periods.upTo}.`
                    : `No period of ${year} has started yet.`}
                </p>
              )}
              {allMode && !!year && !teamFormats.length && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">There is no approved monthly report format for {year}{isAdmin && departmentId ? ' in this department' : ''}.</p>
              )}
            </>
          )}
        </Card>
      </div>

      {ready && (loading ? <Loader /> : error ? <p className="text-red-600 dark:text-red-400">{error}</p> : table && (
        <div className="space-y-6">
          <SheetCard
            woredas={woredaCols} table={table} isRange={!!isRange} link={!allMode}
            title={allMode ? `${table.versionName}${periodLabel ? ` — ${periodLabel}` : ''}` : (isRange ? periodLabel : 'All woredas')}
            className={PRINT_CARD}
          />
          {allMode && (isDeptHead || isAdmin) && (
            <FeedbackPanel
              title="Department feedback on the report achievement" role={user.role} params={feedbackParams}
              enabled={feedbackReady}
              note={isAdmin ? 'Choose a department, a zone and a period to see or give the department feedback.' : 'Choose a period to give feedback.'}
              hint={`One feedback for the whole department — all teams at once, not one per team — on how it did in ${periodLabel || 'this period'} ${year}. There is no score.`}
            />
          )}
        </div>
      ))}
    </>
  );
}
