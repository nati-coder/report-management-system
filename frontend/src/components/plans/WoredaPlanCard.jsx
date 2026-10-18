import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import GridCell from '../common/GridCell.jsx';
import { TableActions, PrintHeader, PRINT_CARD } from './TableActions.jsx';
import { calcParents, fmt, hierarchyIssues, toNumbers, totalState } from '../../utils/planChecks.js';

const STATUS = { draft: ['draft', 'gray'], submitted: ['cascaded', 'blue'], approved: ['accepted', 'green'], rejected: ['rejected', 'red'] };

/**
 * Step 2 — one table for the whole cascade: every item against the zone plan and every woreda of the zone, with the
 * total and what is left. The woreda chosen in the combo box (or by clicking its column) is the one you type into,
 * spreadsheet-style; the other woredas' columns are read-only. Parents must equal the sum of their sub-items, and
 * cascading is blocked while a check fails. The same table is what Excel / CSV / Print give you.
 */
export default function WoredaPlanCard({
  items, parents, zoneData, woredas, plans, woredaId, setWoredaId, values, setValues, onSave, saving, serverIssues, table,
}) {
  const planOf = (id) => plans.find((p) => p.woreda_id === id);
  const woreda = woredas.find((w) => w.woreda_id === woredaId);
  const plan = woreda ? planOf(woreda.woreda_id) : null;
  const locked = !!plan && !['draft', 'rejected'].includes(plan.status);

  const zoneItems = items.filter((it) => zoneData[it.key] !== undefined);
  const nums = toNumbers(values);
  const issues = hierarchyIssues(parents, nums);
  const computed = new Set(parents.filter((p) => p.children.some((c) => zoneData[c.key] !== undefined)).map((p) => p.key));

  const othersOf = (key) => plans.filter((p) => p.woreda_id !== woredaId).reduce((s, p) => s + (Number(p.data?.[key]) || 0), 0);
  const others = plans.filter((p) => p.woreda_id !== woredaId);
  const everyoneElseCascaded = woredas.every((w) => w.woreda_id === woredaId || ['submitted', 'approved'].includes(planOf(w.woreda_id)?.status));
  const cascadedCount = woredas.filter((w) => ['submitted', 'approved'].includes(planOf(w.woreda_id)?.status)).length;

  // Everything that stops this woreda being cascaded right now
  const blockers = [];
  for (const it of zoneItems) {
    if (issues[it.key]) blockers.push(`${it.label} ${issues[it.key]}`);
    if (it.isPercent) continue;
    const { remaining, state } = totalState(zoneData[it.key], othersOf(it.key), nums[it.key] ?? 0);
    if (state === 'over') blockers.push(`${it.label}: ${fmt(-remaining)} more than the zone plan allows`);
    if (state === 'short' && everyoneElseCascaded) blockers.push(`${it.label}: every other woreda is planned, so this one must use the last ${fmt(remaining)}`);
  }

  const useRemaining = () => setValues((v) => {
    const next = { ...v };
    for (const it of zoneItems) {
      if (computed.has(it.key)) continue; // parents are summed from their sub-items below
      next[it.key] = String(it.isPercent ? zoneData[it.key] : Math.max(0, Math.round((zoneData[it.key] - othersOf(it.key)) * 100) / 100));
    }
    return calcParents(parents, next);
  });

  const statusOf = (w) => { const p = planOf(w.woreda_id); return p ? STATUS[p.status][0] : 'not started'; };
  const colH = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
  const colD = 'border border-slate-300 px-2 py-1.5 text-right tabular-nums dark:border-slate-600';

  return (
    <Card title="Step 2 — Woreda plans" className={PRINT_CARD} actions={<TableActions table={table} />}>
      <PrintHeader table={table} />
      <div className="print:hidden">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="label" htmlFor="woreda-combo">Woreda</label>
            <select id="woreda-combo" aria-label="Woreda" className="input" value={woredaId} onChange={(e) => setWoredaId(e.target.value)}>
              <option value="">Select a woreda…</option>
              {woredas.map((w) => <option key={w.woreda_id} value={w.woreda_id}>{w.name} — {statusOf(w)}</option>)}
            </select>
          </div>
          <p className="self-end text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
            {cascadedCount} of {woredas.length} woreda{woredas.length === 1 ? '' : 's'} cascaded. Woredas' targets must add up to the zone plan
            {' '}— never more, and exactly once every woreda is planned. Click a woreda's name in the table to plan it.
          </p>
        </div>

        {serverIssues.length > 0 && (
          <ul className="mb-3 list-disc rounded-lg bg-red-50 p-3 pl-7 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {serverIssues.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}

        {!woreda ? (
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Choose a woreda to enter its plan.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">{woreda.name} {plan && <Badge tone={STATUS[plan.status][1]}>{STATUS[plan.status][0]}</Badge>}</div>
              <div className="flex flex-wrap gap-2">
                {parents.length > 0 && <Button variant="secondary" disabled={locked} onClick={() => setValues((v) => calcParents(parents, v))}>Calculate parent totals</Button>}
                <Button variant="secondary" disabled={locked} onClick={useRemaining}>Use remaining zone amount</Button>
                <Button variant="secondary" loading={saving} disabled={locked} onClick={() => onSave(false)}>Save draft</Button>
                <Button loading={saving} disabled={locked || blockers.length > 0} onClick={() => onSave(true)}>Cascade to {woreda.name}</Button>
              </div>
            </div>
            {plan?.rejection_reason && !locked && (
              <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {woreda.name} rejected this plan: {plan.rejection_reason}. Revise it and cascade again.
              </p>
            )}
            {locked && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{plan.status === 'approved' ? `${woreda.name} has accepted this plan; it is locked.` : "This woreda's plan has been cascaded and is waiting for the woreda to accept it. It is locked."}</p>}
            {!locked && blockers.length > 0 && (
              <ul className="mb-3 list-disc rounded-lg bg-amber-50 p-3 pl-7 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {blockers.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="plan-table grid-table w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
              <th className={`${colH} sticky left-0 z-10 bg-slate-100 dark:bg-slate-900`}>Item</th>
              <th className={`${colH} text-right`}>Zone plan</th>
              {woredas.map((w) => (
                <th key={w.woreda_id} className={`${colH} text-right ${w.woreda_id === woredaId ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}`}>
                  <button type="button" className="font-semibold uppercase hover:underline print:no-underline" title={`Plan ${w.name}`} onClick={() => setWoredaId(w.woreda_id)}>{w.name}</button>
                </th>
              ))}
              <th className={`${colH} text-right`}>Total</th>
              <th className={`${colH} text-right`}>Left</th>
            </tr>
          </thead>
          <tbody>
            {zoneItems.map((it, ri) => {
              const zone = zoneData[it.key];
              const own = nums[it.key] ?? 0;
              const st = it.isPercent ? null : totalState(zone, othersOf(it.key), own);
              return (
                <tr key={it.key}>
                  <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" style={{ paddingLeft: 8 + Math.min(it.depth, 6) * 14 }}>
                    <div className="font-medium">{it.label}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{it.measurement}{woreda && computed.has(it.key) ? ' · sum of sub-items' : ''}</div>
                    {woreda && issues[it.key] && <div className="text-xs text-red-600 dark:text-red-400 print:hidden">{it.label} {issues[it.key]}</div>}
                  </td>
                  <td className={`${colD} font-medium`}>{fmt(zone)}{it.isPercent ? '%' : ''}</td>
                  {woredas.map((w) => (w.woreda_id === woredaId ? (
                    <td key={w.woreda_id} className="border border-slate-300 bg-emerald-50/50 p-0 dark:border-slate-600 dark:bg-emerald-900/10">
                      <GridCell r={ri} c={0} label={`${w.name} target for ${it.label}`} disabled={locked || computed.has(it.key)} invalid={!!issues[it.key]}
                        value={values[it.key] ?? ''} onChange={(v) => setValues((cur) => ({ ...cur, [it.key]: v }))} />
                    </td>
                  ) : (
                    <td key={w.woreda_id} className={colD}>
                      {planOf(w.woreda_id)?.data?.[it.key] !== undefined ? fmt(planOf(w.woreda_id).data[it.key]) : '—'}
                    </td>
                  )))}
                  <td className={colD}>{it.isPercent ? '—' : fmt(othersOf(it.key) + own)}</td>
                  <td className={`${colD} text-xs font-medium`}>
                    {!st ? '—' : st.state === 'ok'
                      ? <span className="text-emerald-600 dark:text-emerald-400">✓ matches</span>
                      : st.state === 'short'
                        ? <span className="text-amber-600 dark:text-amber-400">{fmt(st.remaining)} left</span>
                        : <span className="text-red-600 dark:text-red-400">over by {fmt(-st.remaining)}</span>}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-semibold dark:bg-slate-900/40">
              <td className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">Status</td>
              <td className={colD} />
              {woredas.map((w) => <td key={w.woreda_id} className={`${colD} text-xs font-normal`}>{statusOf(w)}</td>)}
              <td className={colD} /><td className={colD} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 print:hidden">
        Totals count every saved plan, drafts included, plus what you are typing. A percentage is a rate, so it isn't added up or limited by the zone plan.
        Type, use the arrow keys / Enter to move between cells, or paste a block copied from Excel.
      </p>
    </Card>
  );
}
