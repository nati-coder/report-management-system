import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import GridCell from '../common/GridCell.jsx';
import { TableActions, PrintHeader, PRINT_CARD } from './TableActions.jsx';
import { fmt, hierarchyIssues } from '../../utils/planChecks.js';
import { MONTHS, MONTH_NAMES, calcParentMonths, computedParents, monthMap, splitEvenly, totalOf } from '../../utils/planSplit.js';

const H = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
const D = 'border border-slate-300 px-2 py-1.5 text-right tabular-nums dark:border-slate-600';
const STATUS = { draft: ['draft', 'gray'], submitted: ['cascaded', 'blue'], approved: ['accepted', 'green'], rejected: ['rejected', 'red'] };

/**
 * One woreda's monthly plan. Its cascaded annual plan is divided across twelve months — either automatically
 * (an even split) or by typing the months by hand. Each item shows how much of its annual target is still unplaced;
 * parents are the sum of their sub-items in every month. Cascading is blocked while a check fails.
 */
export default function MonthlyPlanCard({
  woreda, items, parents, annualData, values, setValues, status, locked, onDivide, onSave, saving, serverIssues, blockers, table,
}) {
  const annualItems = items.filter((it) => annualData[it.key] !== undefined);
  const computed = computedParents(parents, annualData);

  const setCell = (key, m, v) => setValues((cur) => {
    const row = [...(cur[key] || Array(MONTHS).fill(''))];
    row[m] = v;
    return { ...cur, [key]: row };
  });
  /** Even split of one item (a computed parent is re-summed from its sub-items instead). */
  const splitRow = (it) => setValues((cur) => {
    if (computed.has(it.key)) return calcParentMonths(parents.filter((p) => computed.has(p.key)), cur);
    return calcParentMonths(parents.filter((p) => computed.has(p.key)), { ...cur, [it.key]: splitEvenly(annualData[it.key], it.isPercent) });
  });
  const clearAll = () => setValues((cur) => Object.fromEntries(Object.keys(cur).map((k) => [k, Array(MONTHS).fill('')])));
  const recalc = () => setValues((cur) => calcParentMonths(parents.filter((p) => computed.has(p.key)), cur));

  // Per-month hierarchy problems, e.g. "September: 1.1 should be 12 (sum of sub-items), not 10".
  const monthIssues = [];
  for (let m = 0; m < MONTHS; m += 1) {
    const nums = Object.fromEntries(Object.entries(monthMap(values, m)).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
    const issues = hierarchyIssues(parents, nums);
    for (const [k, msg] of Object.entries(issues)) monthIssues.push({ m, k, msg });
  }

  return (
    <Card title="Monthly plan" className={PRINT_CARD} actions={<TableActions table={table} />}>
      <PrintHeader table={table} />
      <div className="print:hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {woreda.name} {status && <Badge tone={STATUS[status][1]}>{STATUS[status][0]}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={locked} onClick={clearAll}>Clear months</Button>
          {parents.length > 0 && <Button variant="secondary" disabled={locked} onClick={recalc}>Calculate parent totals</Button>}
          <Button variant="secondary" disabled={locked} onClick={onDivide}>Divide evenly</Button>
          <Button variant="secondary" loading={saving} disabled={locked} onClick={() => onSave(false)}>Save draft</Button>
          <Button loading={saving} disabled={locked || blockers.length > 0} onClick={() => onSave(true)}>Cascade to {woreda.name}</Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        <strong>Divide evenly</strong> fills every month from the annual plan (counts stay whole numbers, the first months take any extra; a percentage repeats its annual rate).
        Then change any month by hand — type, use the arrow keys / Enter to move between cells, or paste a block copied from Excel. The <em>Left</em> column shows what is still unplaced; the ÷ button re-splits a single item.
      </p>

      {serverIssues.length > 0 && (
        <ul className="mb-3 list-disc rounded-lg bg-red-50 p-3 pl-7 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {serverIssues.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {locked && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">This monthly plan has been cascaded to {woreda.name}; it is locked.</p>}
      {!locked && blockers.length > 0 && (
        <ul className="mb-3 list-disc rounded-lg bg-amber-50 p-3 pl-7 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {blockers.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}

      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="plan-table grid-table min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
              <th className={`${H} sticky left-0 z-10 bg-slate-100 dark:bg-slate-900`}>Item</th>
              <th className={`${H} text-right`}>Annual</th>
              {Array.from({ length: MONTHS }, (_, i) => <th key={i} className={`${H} text-right`}>{MONTH_NAMES[i]}</th>)}
              <th className={`${H} text-right`}>Total</th>
              <th className={`${H} text-right`}>Left</th>
            </tr>
          </thead>
          <tbody>
            {annualItems.map((it, ri) => {
              const annual = annualData[it.key];
              const total = totalOf(values[it.key]);
              const left = Math.round((annual - total) * 100) / 100;
              const isComputed = computed.has(it.key);
              return (
                <tr key={it.key}>
                  <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" style={{ paddingLeft: 8 + Math.min(it.depth, 6) * 14 }}>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">{it.label}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{it.measurement}{isComputed ? ' · sum of sub-items' : ''}</div>
                      </div>
                      {!locked && !isComputed && (
                        <button type="button" title="Divide this item evenly" aria-label={`Divide ${it.label} evenly`}
                          className="rounded border border-slate-300 px-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 print:hidden"
                          onClick={() => splitRow(it)}>÷</button>
                      )}
                    </div>
                  </td>
                  <td className={`${D} font-medium`}>{fmt(annual)}{it.isPercent ? '%' : ''}</td>
                  {Array.from({ length: MONTHS }, (_, m) => (
                    <td key={m} className="border border-slate-300 p-0 dark:border-slate-600">
                      <GridCell r={ri} c={m} label={`${it.label}, ${MONTH_NAMES[m]}`} disabled={locked || isComputed}
                        value={values[it.key]?.[m] ?? ''} onChange={(v) => setCell(it.key, m, v)} />
                    </td>
                  ))}
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
      {monthIssues.length > 0 && (
        <ul className="mt-3 list-disc rounded-lg bg-amber-50 p-3 pl-7 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 print:hidden">
          {monthIssues.map(({ m, k, msg }) => <li key={`${m}-${k}`}>{MONTH_NAMES[m]}: {annualItems.find((i) => i.key === k)?.label ?? k} {msg}</li>)}
        </ul>
      )}
    </Card>
  );
}
