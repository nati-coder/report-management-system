import { MONTH_OPTIONS, RANGE_OPTIONS } from '../../utils/periods.js';

const PERIODS = [
  ...[RANGE_OPTIONS[RANGE_OPTIONS.length - 1], ...RANGE_OPTIONS.slice(0, -1)].map((r) => ({ value: r.value, label: r.label })),
  ...MONTH_OPTIONS.map((m) => ({ value: `month:${m.value}`, label: m.label })),
];
/** 'q2' -> { period: 'q2' }, 'month:9' -> { period: 'month', month: 9 } */
export const periodParams = (v) => (v.startsWith('month:') ? { period: 'month', month: Number(v.slice(6)) } : { period: v });

const L = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';

/**
 * Filters of the Rank page. Fiscal year, period and the "cap" are for everyone; zone and department are a choice only for
 * the admin (everyone else is held to the ones on their account, so they only see them as text).
 */
export default function RankFilters({ value, onChange, isAdmin, zones, departments, scopeText, children }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <label><span className={L}>Year</span>
        <input type="number" className="input w-24" value={value.year} onChange={(e) => set({ year: Number(e.target.value) })} /></label>
      <label><span className={L}>Period</span>
        <select className="input w-56" value={value.period} onChange={(e) => set({ period: e.target.value })}>
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select></label>
      {isAdmin ? (
        <>
          <label><span className={L}>Zone</span>
            <select className="input w-44" value={value.zoneId} onChange={(e) => set({ zoneId: e.target.value })}>
              {zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}</select></label>
          <label><span className={L}>Department</span>
            <select className="input w-48" value={value.departmentId} onChange={(e) => set({ departmentId: e.target.value, teamId: '' })}>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        </>
      ) : scopeText && <p className="pb-2 text-sm text-slate-500 dark:text-slate-400">{scopeText}</p>}
      {children}
      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300" title="An item above its target counts as 100% at most, so one item far over target cannot hide weak ones">
        <input type="checkbox" checked={value.cap} onChange={(e) => set({ cap: e.target.checked })} /> Cap items at 100%
      </label>
    </div>
  );
}
