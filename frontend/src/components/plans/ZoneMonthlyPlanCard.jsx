import Card from '../common/Card.jsx';
import Badge from '../common/Badge.jsx';
import { TableActions, PrintHeader, PRINT_CARD } from './TableActions.jsx';
import { fmt } from '../../utils/planChecks.js';
import { MONTHS, MONTH_NAMES, totalOf } from '../../utils/planSplit.js';

const H = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
const D = 'border border-slate-300 px-2 py-1.5 text-right tabular-nums dark:border-slate-600';
const STATE_TONE = { cascaded: 'green', draft: 'amber', 'not started': 'gray', 'annual plan not cascaded': 'gray' };

/**
 * The zone's plan, month by month: the zone's annual targets against what the woreda monthly plans add up to
 * (see utils/zoneMonthly.js). Read-only — it is worked out from the woredas, so it is changed by changing theirs.
 *   woredaStates = [{ woreda_id, name, state }]  state: 'cascaded' | 'draft' | 'not started' | 'annual plan not cascaded'
 */
export default function ZoneMonthlyPlanCard({ items, zoneData, values, woredaStates, table }) {
  const zoneItems = items.filter((it) => zoneData[it.key] !== undefined);
  const cascaded = woredaStates.filter((w) => w.state === 'cascaded').length;

  return (
    <Card title="Zone monthly plan" className={PRINT_CARD} actions={<TableActions table={table} disabled={!zoneItems.length} />}>
      <PrintHeader table={table} />
      <div className="print:hidden">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          The zone's months add up the woredas' cascaded monthly plans (percentages are rates, so they are averaged). The <em>Left</em> column is what the woredas have not placed yet — it reaches zero once every woreda has cascaded its months.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{cascaded} of {woredaStates.length} woredas have a cascaded monthly plan</span>
          {woredaStates.map((w) => <Badge key={w.woreda_id} tone={STATE_TONE[w.state] || 'gray'}>{w.name} · {w.state}</Badge>)}
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="plan-table min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
              <th className={`${H} sticky left-0 z-10 bg-slate-100 dark:bg-slate-900`}>Item</th>
              <th className={`${H} text-right`}>Zone annual</th>
              {Array.from({ length: MONTHS }, (_, i) => <th key={i} className={`${H} text-right`}>{MONTH_NAMES[i]}</th>)}
              <th className={`${H} text-right`}>Total</th>
              <th className={`${H} text-right`}>Left</th>
            </tr>
          </thead>
          <tbody>
            {zoneItems.map((it) => {
              const annual = zoneData[it.key];
              const total = totalOf(values[it.key]);
              const left = Math.round((annual - total) * 100) / 100;
              return (
                <tr key={it.key}>
                  <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" style={{ paddingLeft: 8 + Math.min(it.depth, 6) * 14 }}>
                    <div className="font-medium">{it.label}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{it.measurement}</div>
                  </td>
                  <td className={`${D} font-medium`}>{fmt(annual)}{it.isPercent ? '%' : ''}</td>
                  {Array.from({ length: MONTHS }, (_, m) => {
                    const v = values[it.key]?.[m];
                    return <td key={m} className={D}>{v === '' || v === undefined ? '—' : `${fmt(Number(v))}${it.isPercent ? '%' : ''}`}</td>;
                  })}
                  <td className={D}>{it.isPercent ? '—' : fmt(total)}</td>
                  <td className={`${D} text-xs font-medium`}>
                    {it.isPercent ? '—' : Math.abs(left) <= 0.005
                      ? <span className="text-emerald-600 dark:text-emerald-400">✓ matches</span>
                      : left > 0
                        ? <span className="text-amber-600 dark:text-amber-400">{fmt(left)} left</span>
                        : <span className="text-red-600 dark:text-red-400">over by {fmt(-left)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
