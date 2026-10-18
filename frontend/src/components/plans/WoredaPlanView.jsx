import { useMemo } from 'react';
import { formatRows, indicatorsOf, isPercent } from '../../utils/formatTree.js';
import { fmt } from '../../utils/planChecks.js';

/**
 * Read-only view of a plan cascaded to a woreda: the report format's outline with this woreda's annual
 * target next to every measured item. Items with no target are shown as "—" (not planned this year).
 */
export default function WoredaPlanView({ format, data = {} }) {
  const schema = format?.schema_definition;
  const outline = Array.isArray(schema?.nodes);
  const rows = useMemo(() => (outline
    ? formatRows(schema)
    : indicatorsOf(schema).map((i) => ({ code: i.key, title: i.title, measurement: i.measurement, depth: 0 }))), [schema, outline]);

  if (!rows.length) return <p className="text-sm text-slate-500 dark:text-slate-400">This format has no items.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
          <tr>
            {outline && <th className="w-24 px-3 py-3 font-medium">No.</th>}
            <th className="px-3 py-3 font-medium">Item</th>
            <th className="w-40 px-3 py-3 font-medium">Measurement</th>
            <th className="w-36 px-3 py-3 text-right font-medium">Annual target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map((r) => {
            const heading = !r.measurement;
            const v = data[r.code];
            return (
              <tr key={r.code} className={heading ? 'bg-slate-50 font-semibold dark:bg-slate-900/40' : ''}>
                {outline && <td className="px-3 py-2 align-top font-mono text-xs">{r.code}.</td>}
                <td className="py-2 pr-3 align-top" style={{ paddingLeft: 12 + Math.min(r.depth, 10) * 20 }}>{r.title}</td>
                <td className="px-3 py-2 align-top text-slate-500 dark:text-slate-400">{r.measurement}</td>
                <td className="px-3 py-2 text-right align-top font-medium tabular-nums">
                  {heading ? '' : v === undefined ? <span className="font-normal text-slate-400 dark:text-slate-500">—</span> : `${fmt(Number(v))}${isPercent(r.measurement) ? '%' : ''}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
