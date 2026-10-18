import { useMemo, useState } from 'react';
import Button from '../common/Button.jsx';
import GridCell from '../common/GridCell.jsx';
import { schemaRows, isPercent } from '../../utils/formatTree.js';
import { fmt } from '../../utils/planChecks.js';

/**
 * Renders inputs from a template json_schema:
 * { "sections": [ { "title": "…", "fields": [ { "key","label","type","required","options","unit","min","max" } ] } ] }
 * or a flat { "fields": [...] }.  Types: text | textarea | number | percentage | currency | date | boolean | select
 *
 * Also renders a report-format hierarchy: { "nodes": [ { code, title, measurement, children } ] } as a
 * numbered outline (1. / 1.1. / 1.1.1. …). Every item with a measurement gets a numeric input
 * (values are keyed by the item's code); items without one are headings.
 */
const flatten = (schema) => (schema?.sections ? schema.sections : [{ title: null, fields: schema?.fields || [] }]);

/**
 * `plan` (optional) = the woreda's accepted annual plan data, { "<item code>": target }. When given, the outline
 * shows only the items that have a target (and the headings above them). Each item is a row of a table:
 * Plan (the target) | Report (what was reported — typed here, or just shown when read-only) | Achieved.
 * `target` (optional) = the targets to show in the Plan column when they differ from the annual plan, e.g. one
 * month's plan for a monthly report; `planLabel` names that column.
 */
export default function DynamicReportForm({ schema, plan = null, target = null, planLabel = 'Plan', initialData = {}, readOnly = false, onSave, saving = false }) {
  const sections = useMemo(() => flatten(schema), [schema]);
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const isTree = Array.isArray(schema?.nodes);
  const allRows = useMemo(() => (isTree ? schemaRows(schema.nodes) : []), [schema, isTree]);
  const planned = (code) => plan?.[code] !== undefined;
  // only what the plan covers is sent: anything else left over from an older draft is dropped
  const targets = target || plan;
  // report values are kept as typed (text) while editing and sent as numbers; blanks are left out
  const payload = () => Object.fromEntries(Object.entries(data)
    .filter(([k, v]) => (!plan || planned(k)) && v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => [k, isTree ? Number(v) : v]));
  const treeRows = useMemo(() => {
    if (!plan) return allRows;
    const codes = allRows.filter(({ n }) => n.measurement && plan[n.code] !== undefined).map(({ n }) => n.code);
    // a planned item, or a heading / parent above one
    return allRows.filter(({ n }) => codes.includes(n.code) || codes.some((c) => c.startsWith(`${n.code}.`)));
  }, [allRows, plan]);

  const validate = () => {
    const e = {};
    if (isTree) {
      for (const { n } of treeRows) {
        if (!n.measurement) continue;
        const v = data[n.code];
        if (v === undefined || v === null || v === '') continue;
        const num = Number(v);
        if (Number.isNaN(num)) e[n.code] = 'Must be a number';
        else if (num < 0) e[n.code] = 'Cannot be negative';
        else if (isPercent(n.measurement) && (num < 0 || num > 100)) e[n.code] = 'Must be between 0 and 100';
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    }
    for (const s of sections) for (const f of s.fields) {
      const v = data[f.key];
      const empty = v === undefined || v === null || v === '';
      if (f.required && empty) e[f.key] = 'Required';
      else if (!empty && ['number', 'percentage', 'currency'].includes(f.type)) {
        const n = Number(v);
        if (Number.isNaN(n)) e[f.key] = 'Must be a number';
        else if (f.type === 'percentage' && (n < 0 || n > 100)) e[f.key] = 'Must be between 0 and 100';
        else if (f.min !== undefined && n < f.min) e[f.key] = `Minimum is ${f.min}`;
        else if (f.max !== undefined && n > f.max) e[f.key] = `Maximum is ${f.max}`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const renderField = (f) => {
    const common = { id: f.key, disabled: readOnly, className: 'input', value: data[f.key] ?? '' };
    switch (f.type) {
      case 'textarea': return <textarea rows={3} {...common} onChange={(e) => set(f.key, e.target.value)} />;
      case 'select':
        return (
          <select {...common} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">—</option>
            {(f.options || []).map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
          </select>
        );
      case 'boolean':
        return <input type="checkbox" id={f.key} disabled={readOnly} checked={!!data[f.key]} onChange={(e) => set(f.key, e.target.checked)} className="h-4 w-4" />;
      case 'date': return <input type="date" {...common} onChange={(e) => set(f.key, e.target.value)} />;
      case 'number': case 'percentage': case 'currency':
        return <input type="number" step="any" {...common} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />;
      default: return <input type="text" {...common} onChange={(e) => set(f.key, e.target.value)} />;
    }
  };

  if (!schema) return <p className="text-sm text-slate-500 dark:text-slate-400">No template schema.</p>;

  if (isTree) {
    const H = 'border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600';
    const D = 'border border-slate-300 px-2 py-1.5 dark:border-slate-600';
    let cell = 0; // row number among the input cells, for keyboard movement
    const rows = treeRows.map(({ n, d }) => ({ n, d, input: !!n.measurement && (!plan || planned(n.code)) ? cell++ : -1 }));
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="plan-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                <th className={H}>Item</th>
                <th className={H}>Measurement</th>
                {plan && <th className={`${H} text-right`}>{planLabel}</th>}
                <th className={`${H} text-right`}>Report</th>
                {plan && <th className={`${H} text-right`}>Achieved</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ n, d, input }) => {
                const label = (
                  <td className={D} style={{ paddingLeft: 8 + Math.min(d, 8) * 18 }}>
                    <span className="mr-2 font-mono text-xs text-slate-500 dark:text-slate-400">{n.code}.</span>
                    <span className={n.measurement ? '' : 'font-semibold text-slate-800 dark:text-slate-100'}>{n.title}</span>
                  </td>
                );
                if (input < 0) {
                  return <tr key={n.code} className={n.measurement ? '' : 'bg-slate-50 dark:bg-slate-900/30'}>{label}<td className={D} colSpan={plan ? 4 : 2}>{n.measurement ? <span className="text-xs text-slate-400">not in the plan</span> : null}</td></tr>;
                }
                const pct = isPercent(n.measurement);
                const t = targets?.[n.code];
                const v = data[n.code];
                const has = v !== undefined && v !== null && v !== '';
                const achieved = plan && !pct && has && Number(t) > 0 ? `${fmt((Number(v) / Number(t)) * 100)}%` : '—';
                return (
                  <tr key={n.code}>
                    {label}
                    <td className={`${D} text-xs text-slate-500 dark:text-slate-400`}>{n.measurement}</td>
                    {plan && <td className={`${D} text-right tabular-nums`}>{t !== undefined ? `${fmt(Number(t))}${pct ? '%' : ''}` : '—'}</td>}
                    {readOnly ? (
                      <td className={`${D} text-right font-semibold tabular-nums`}>{has ? `${fmt(Number(v))}${pct ? '%' : ''}` : '—'}</td>
                    ) : (
                      <td className="border border-slate-300 p-0 dark:border-slate-600">
                        <GridCell r={input} c={0} label={`Report for ${n.title}`} invalid={!!errors[n.code]} value={has ? String(v) : ''} onChange={(x) => set(n.code, x)} />
                        {errors[n.code] && <p className="px-2 pb-1 text-xs text-red-600">{errors[n.code]}</p>}
                      </td>
                    )}
                    {plan && <td className={`${D} text-right tabular-nums text-xs`}>{achieved}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {plan && !treeRows.length && <p className="text-sm text-slate-500 dark:text-slate-400">The accepted plan has no targets to report against.</p>}
        {!readOnly && <p className="text-xs text-slate-400 dark:text-slate-500">Type, use the arrow keys / Enter to move between cells, or paste a column copied from Excel.</p>}
        {!readOnly && <Button loading={saving} onClick={() => validate() && onSave(payload())}>Save draft</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <fieldset key={i} className="rounded-lg border border-slate-200 p-4 dark:border-slate-600">
          {s.title && <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{s.title}</legend>}
          <div className="grid gap-4 md:grid-cols-2">
            {s.fields.map((f) => (
              <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                <label htmlFor={f.key} className="label">
                  {f.label}{f.unit ? ` (${f.unit})` : ''}{f.required && <span className="text-red-500"> *</span>}
                </label>
                {renderField(f)}
                {errors[f.key] && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      {!readOnly && <Button loading={saving} onClick={() => validate() && onSave(data)}>Save draft</Button>}
    </div>
  );
}
