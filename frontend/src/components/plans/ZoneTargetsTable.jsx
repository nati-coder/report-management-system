import { useMemo } from 'react';
import Badge from '../common/Badge.jsx';
import { formatRows, indicatorsOf, isPercent } from '../../utils/formatTree.js';
import { fmt } from '../../utils/planChecks.js';

/** How a woreda's plan is shown to the zone: label + badge tone. */
export const PLAN_STATUS = {
    draft: ['draft', 'gray'],
    submitted: ['awaiting woreda', 'blue'],
    approved: ['accepted', 'green'],
    rejected: ['rejected', 'red'],
};

/**
 * One team's plan across the zone: the report format's items down the side, the zone target and then every
 * woreda's target across the top (with that woreda's plan status). "—" = no target.
 */
export default function ZoneTargetsTable({ format, zoneData, woredas, plans }) {
    const schema = format?.schema_definition;
    const outline = Array.isArray(schema?.nodes);
    const rows = useMemo(() => (outline
        ? formatRows(schema)
        : indicatorsOf(schema).map((i) => ({ code: i.key, title: i.title, measurement: i.measurement, depth: 0 }))), [schema, outline]);

    if (!rows.length) return <p className="text-sm text-slate-500 dark:text-slate-400">This format has no items.</p>;

    const show = (v, measurement) => (v === undefined
        ? <span className="font-normal text-slate-400 dark:text-slate-500">—</span>
        : `${fmt(Number(v))}${isPercent(measurement) ? '%' : ''}`);

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                    <tr>
                        {outline && <th className="w-20 px-3 py-3 font-medium">No.</th>}
                        <th className="min-w-[14rem] px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Measurement</th>
                        <th className="px-3 py-3 text-right font-medium">Zone</th>
                        {woredas.map((w) => {
                            const p = plans[w.woreda_id];
                            const [label, tone] = p ? PLAN_STATUS[p.status] || [p.status, 'gray'] : [null, null];
                            return (
                                <th key={w.woreda_id} className="whitespace-nowrap px-3 py-3 text-right font-medium">
                                    <div>{w.name}</div>
                                    {p ? <Badge tone={tone}>{label}</Badge> : <span className="text-[10px] font-normal normal-case text-slate-400">not planned</span>}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {rows.map((r) => {
                        const heading = !r.measurement;
                        return (
                            <tr key={r.code} className={heading ? 'bg-slate-50 font-semibold dark:bg-slate-900/40' : ''}>
                                {outline && <td className="px-3 py-2 align-top font-mono text-xs">{r.code}.</td>}
                                <td className="py-2 pr-3 align-top" style={{ paddingLeft: 12 + Math.min(r.depth, 10) * 20 }}>{r.title}</td>
                                <td className="px-3 py-2 align-top text-slate-500 dark:text-slate-400">{r.measurement}</td>
                                <td className="px-3 py-2 text-right align-top font-medium tabular-nums">{heading ? '' : show(zoneData?.[r.code], r.measurement)}</td>
                                {woredas.map((w) => (
                                    <td key={w.woreda_id} className="px-3 py-2 text-right align-top tabular-nums">{heading ? '' : show(plans[w.woreda_id]?.data?.[r.code], r.measurement)}</td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
