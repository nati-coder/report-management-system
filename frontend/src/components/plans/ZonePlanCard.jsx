import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import GridCell from '../common/GridCell.jsx';
import { calcParents, hierarchyIssues, toNumbers } from '../../utils/planChecks.js';

/**
 * Step 1 — the zone plan: the zone's annual target for each measured item. Parents must equal the sum
 * of their sub-items. Only a consistent zone plan can be saved.
 */
export default function ZonePlanCard({ items, parents, values, setValues, saved, dirty, onSave, saving, cascadedCount, serverIssues }) {
  const issues = hierarchyIssues(parents, toNumbers(values));
  const parentKeys = new Set(parents.map((p) => p.key));
  const num = (v) => (v === '' || v === undefined ? null : Number(v));

  return (
    <Card
      title="Step 1 — Zone plan"
      actions={(
        <div className="flex items-center gap-2">
          {saved ? <Badge tone={dirty ? 'amber' : 'green'}>{dirty ? 'unsaved changes' : 'saved'}</Badge> : <Badge tone="gray">not saved yet</Badge>}
          {parents.length > 0 && <Button variant="secondary" onClick={() => setValues((v) => calcParents(parents, v))}>Calculate parent totals</Button>}
          <Button loading={saving} onClick={onSave}>Save zone plan</Button>
        </div>
      )}
    >
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Enter the zone's annual target for each item — type, use the arrow keys / Enter to move between cells, or paste a column from Excel. Leave an item blank if it isn't planned this year — woredas can only be planned for items that are here.
        A parent must equal the sum of its sub-items.
        {cascadedCount > 0 && ` ${cascadedCount} woreda${cascadedCount === 1 ? ' has' : 's have'} already been cascaded, so the zone plan can't go below what they were given.`}
      </p>
      {serverIssues.length > 0 && (
        <ul className="mb-3 list-disc rounded-lg bg-red-50 p-3 pl-7 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {serverIssues.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
            <tr><th className="px-3 py-3 font-medium">Item</th><th className="px-3 py-3 font-medium">Zone plan</th><th className="px-3 py-3 font-medium">Check</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map((it, ri) => (
              <tr key={it.key}>
                <td className="px-3 py-2" style={{ paddingLeft: 12 + Math.min(it.depth, 6) * 14 }}>
                  <div className="font-medium">{it.label}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{it.measurement}</div>
                </td>
                <td className="w-36 border-x border-slate-200 p-0 dark:border-slate-700">
                  <GridCell r={ri} c={0} label={`Zone plan for ${it.label}`} invalid={!!issues[it.key]}
                    value={values[it.key] ?? ''} onChange={(v) => setValues((cur) => ({ ...cur, [it.key]: v }))} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {issues[it.key]
                    ? <span className="text-red-600 dark:text-red-400">{issues[it.key]}</span>
                    : parentKeys.has(it.key) && num(values[it.key]) !== null
                      ? <span className="text-emerald-600 dark:text-emerald-400">✓ equals its sub-items</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
