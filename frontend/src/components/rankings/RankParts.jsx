/** Small building blocks shared by the three rank tables. */

export const fmtPct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`);

const tone = (v) => (v >= 90 ? 'bg-emerald-500' : v >= 70 ? 'bg-lime-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500');

/** Rank in a circle: gold / silver / bronze for 1–3, plain after, a dash when there is nothing to rank. */
export function RankBadge({ rank }) {
  if (rank === null || rank === undefined) return <span className="text-slate-400" title="No plan or report data yet">—</span>;
  const look = rank === 1 ? 'bg-amber-400 text-amber-950' : rank === 2 ? 'bg-slate-300 text-slate-800' : rank === 3 ? 'bg-orange-300 text-orange-950'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200';
  return <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${look}`} aria-label={`Rank ${rank}`}>{rank}</span>;
}

/** Percentage with a bar (the bar stops at 100%, the number does not). */
export function AchievementBar({ value }) {
  if (value === null || value === undefined) return <span className="text-sm text-slate-400">No data</span>;
  const v = Number(value);
  return (
    <div className="flex min-w-[10rem] items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(v, 100)}>
        <div className={`h-full rounded-full ${tone(v)}`} style={{ width: `${Math.max(0, Math.min(v, 100))}%` }} />
      </div>
      <span className="w-16 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmtPct(v)}</span>
    </div>
  );
}

export const TH = 'px-3 py-3 font-medium';
export function RankTable({ children, head }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400"><tr>{head}</tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{children}</tbody>
      </table>
    </div>
  );
}

/** "How it was worked out": the parts the mean is made of. */
export function Breakdown({ label, parts }) {
  if (!parts?.length) return null;
  return (
    <details className="mt-1 text-xs text-slate-500 dark:text-slate-400">
      <summary className="cursor-pointer select-none">{label}</summary>
      <ul className="mt-1 space-y-0.5">
        {parts.map((p) => (
          <li key={p.key} className="flex justify-between gap-6">
            <span>{p.name}</span><span className="tabular-nums">{fmtPct(p.achievement)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
