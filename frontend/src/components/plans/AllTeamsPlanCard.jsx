import Card from '../common/Card.jsx';
import { TableActions, PrintHeader, PRINT_CARD } from './TableActions.jsx';
import { fmt } from '../../utils/planChecks.js';

const H = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
const D = 'border border-slate-300 px-2 py-1.5 text-right tabular-nums dark:border-slate-600';

/**
 * Every team's plan in ONE table (see allTeamsPlanTable in utils/planTable.js): the zone plan and each woreda's plan
 * per item, titled with the report version, no team headings, and one status row. Downloadable and printable.
 */
export default function AllTeamsPlanCard({ table, woredas, title }) {
  const hasRows = table.rows.some((r) => r.kind === 'item');
  return (
    <Card title={title} className={PRINT_CARD} actions={<TableActions table={table} disabled={!hasRows} />}>
      <PrintHeader table={table} />
      {!hasRows ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No team has a plan for this yet.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="plan-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                <th className={`${H} sticky left-0 z-10 bg-slate-100 dark:bg-slate-900`}>Item</th>
                <th className={H}>Measurement</th>
                <th className={`${H} bg-slate-200 text-right dark:bg-slate-800`}>Zone plan</th>
                {woredas.map((w) => <th key={w.woreda_id} className={`${H} text-right`}>{w.name}</th>)}
                <th className={`${H} bg-slate-200 text-right dark:bg-slate-800`}>Woredas total</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => {
                if (r.kind === 'status') {
                  return (
                    <tr key={ri} className="bg-slate-50 font-semibold dark:bg-slate-900/40">
                      <td className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">Status</td>
                      <td className={H} /><td className={D} />
                      {woredas.map((w, i) => <td key={w.woreda_id} className={`${D} text-xs font-normal`}>{r.cells[3 + 1 + i]}</td>)}
                      <td className={D} />
                    </tr>
                  );
                }
                const pct = r.percent ? '%' : '';
                const show = (v) => (typeof v === 'number' ? `${fmt(v)}${pct}` : '—');
                return (
                  <tr key={ri}>
                    <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" style={{ paddingLeft: 8 + Math.min(r.depth, 6) * 14 }}>
                      <span className="mr-2 font-mono text-xs text-slate-400">{r.cells[0]}</span>{r.cells[1]}
                    </td>
                    <td className={`${H} font-normal`}>{r.cells[2]}</td>
                    <td className={`${D} bg-slate-50 font-medium dark:bg-slate-900/40`}>{show(r.cells[3])}</td>
                    {woredas.map((w, i) => <td key={w.woreda_id} className={D}>{show(r.cells[4 + i])}</td>)}
                    <td className={`${D} bg-slate-50 font-medium dark:bg-slate-900/40`}>{show(r.cells[4 + woredas.length])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
