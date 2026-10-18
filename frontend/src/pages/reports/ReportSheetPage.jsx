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
import { MONTH_OPTIONS, RANGE_OPTIONS } from '../../utils/periods.js';
import { REPORT_COUNTED, reportSheetTable, reportStatusText, planStatusText } from '../../utils/planTable.js';
import ReportTabs from '../../components/reports/ReportTabs.jsx';

const H = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
const D = 'border border-slate-300 px-2 py-1.5 text-right tabular-nums dark:border-slate-600';
const REPORT_TONE = { submitted: 'text-blue-600 dark:text-blue-400', reviewing: 'text-amber-600 dark:text-amber-400', approved: 'text-emerald-600 dark:text-emerald-400', rejected: 'text-red-600 dark:text-red-400' };

/**
 * Zone level users and the admin: every woreda's report for one format and period on a single sheet. Per woreda a
 * Plan and a Report column sit side by side, with all-woredas totals and the share of the plan reached first.
 * Downloadable as Excel / CSV and printable.
 */
export default function ReportSheetPage() {
  const { user } = useAuth();
  const isAdmin = user.role === ROLES.ADMIN;
  const { data: ref } = useFetch(() => referenceService.all(), []);
  const { data: formats, loading: formatsLoading } = useFetch(() => reportFormatService.list({ status: 'approved' }), []);

  const [formatId, setFormatId] = useState('');
  const [year, setYear] = useState('');
  const [period, setPeriod] = useState('');   // monthly formats: 'm7' (a month) or q1…q4 / h1 / h2 / annual (summed up from the months)
  const [quarter, setQuarter] = useState('');
  const [zoneId, setZoneId] = useState('');

  const chosen = useMemo(() => (formats || []).find((f) => String(f.id) === String(formatId)), [formats, formatId]);
  const type = chosen?.template_type === 'annual' ? 'monthly' : chosen?.template_type; // an annual format is reported month by month
  useEffect(() => { if (chosen) setYear(String(chosen.version_year)); setPeriod(''); setQuarter(''); }, [chosen?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRange = type === 'monthly' && period && !period.startsWith('m');
  const month = type === 'monthly' && period.startsWith('m') ? period.slice(1) : '';
  const ready = !!chosen && !!year && (type !== 'monthly' || !!period) && (type !== 'quarterly' || !!quarter);
  const { data: sheet, loading, error } = useFetch(
    () => (ready ? reportService.sheet({ format_id: formatId, year, ...(type === 'monthly' ? (isRange ? { range: period } : { month }) : {}), ...(type === 'quarterly' ? { quarter } : {}), ...(isAdmin && zoneId ? { zone_id: zoneId } : {}) }) : Promise.resolve(null)),
    [formatId, year, period, quarter, zoneId, ready]);

  const periodLabel = type === 'monthly' && month ? MONTH_OPTIONS.find((m) => String(m.value) === month)?.label : isRange ? RANGE_OPTIONS.find((r) => r.value === period)?.label : type === 'quarterly' && quarter ? `Q${quarter}` : '';
  const items = useMemo(() => indicatorsOf(sheet?.format?.schema_definition), [sheet]);
  const zoneName = isAdmin ? ref?.zones?.find((z) => z.zone_id === zoneId)?.name : ref?.zones?.find((z) => z.zone_id === user.zone_id)?.name;
  const table = useMemo(() => (sheet ? reportSheetTable({ format: sheet.format, year, periodLabel, zoneName, items, woredas: sheet.woredas, isSummary: !!isRange }) : null),
    [sheet, items, year, periodLabel, zoneName, isRange]);

  if (!ref || formatsLoading) return <Loader />;
  const woredas = sheet?.woredas || [];
  const counted = (w) => (w.report && REPORT_COUNTED.includes(w.report.status) ? w.report : null);
  const hasRows = !!table && table.rows.length > 1;

  return (
    <>
      <div className="print:hidden">
        <Header title="All woredas' reports" subtitle="Every woreda's plan and report on one sheet — for a month, or summed up for a quarter, half year or the year." />
        <ReportTabs />
        <Card title="Report" className="mb-6">
          {!formats?.length ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">There are no approved report formats yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="label" htmlFor="sheet-format">Report format</label>
                <select id="sheet-format" className="input" value={formatId} onChange={(e) => setFormatId(e.target.value)}>
                  <option value="">Select…</option>
                  {formats.map((f) => <option key={f.id} value={f.id}>{f.template_title} — {f.version_name} · {f.team_name} (v{f.version}, {f.template_type})</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sheet-year">Year</label>
                <input id="sheet-year" type="number" className="input" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              {type === 'monthly' && (
                <div>
                  <label className="label" htmlFor="sheet-period">Period</label>
                  <select id="sheet-period" className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="">Select…</option>
                    <optgroup label="Month">{MONTH_OPTIONS.map((m) => <option key={m.value} value={`m${m.value}`}>{m.label}</option>)}</optgroup>
                    <optgroup label="Summed up from the months">{RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</optgroup>
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
          )}
        </Card>
      </div>

      {ready && (loading ? <Loader /> : error ? <p className="text-red-600 dark:text-red-400">{error}</p> : table && (
        <Card title={isRange ? periodLabel : 'All woredas'} className={PRINT_CARD} actions={<TableActions table={table} disabled={!hasRows} />}>
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
                        {w.report?.id ? <Link to={`/reports/${w.report.id}`} className="hover:underline print:no-underline">{w.name}</Link> : w.name}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                    {['Plan', 'Report', 'Achieved'].map((c) => <th key={c} className={`${H} bg-slate-200 text-right dark:bg-slate-800`}>{c}</th>)}
                    {woredas.map((w) => ['Plan', 'Report'].map((c) => <th key={`${w.woreda_id}-${c}`} className={`${H} text-right`}>{c}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, -1).map((r, ri) => {
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
                  <tr className="bg-slate-50 font-semibold dark:bg-slate-900/40">
                    <td className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">Status</td>
                    <td className={H} /><td className={D} colSpan={3} />
                    {woredas.map((w) => [
                      <td key={`${w.woreda_id}-sp`} className={`${D} text-xs font-normal`}>{planStatusText(w)}</td>,
                      <td key={`${w.woreda_id}-sr`} className={`${D} text-xs ${w.months ? (w.months.reported === w.months.expected ? REPORT_TONE.approved : w.months.reported ? REPORT_TONE.reviewing : 'font-normal text-slate-400') : w.report ? REPORT_TONE[w.report.status] : 'font-normal text-slate-400'}`}>
                        {w.report && !w.months && !counted(w) ? `${reportStatusText(w)} (not counted)` : reportStatusText(w)}
                      </td>,
                    ])}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 print:hidden">
            {isRange
              ? 'A summary adds up the monthly reports of its months (percentages are rates, so they are averaged) and sets them against the monthly plans of the same months. The status row shows how many of its months each woreda has reported.'
              : "Plan is the woreda's accepted annual plan (for a monthly report, that month's plan once it is cascaded). Submitted, in-review and approved reports are counted in the totals; percentages are rates, so they aren't added up. Click a woreda's name to open its report."}
          </p>
        </Card>
      ))}
    </>
  );
}
