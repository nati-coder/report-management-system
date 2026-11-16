import { RankBadge, AchievementBar, RankTable, TH } from './RankParts.jsx';

/** Woredas compared on one team's achievement. With several teams (none chosen) each team gets its own table and its own ranks. */
export default function WoredaByTeamTable({ rows }) {
  const byTeam = new Map();
  for (const r of rows) byTeam.set(r.team_id, [...(byTeam.get(r.team_id) || []), r]);
  return (
    <div className="space-y-6">
      {[...byTeam.entries()].map(([teamId, list]) => (
        <section key={teamId} aria-label={`Woreda rank for ${list[0].team_name}`}>
          {byTeam.size > 1 && <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{list[0].team_name}</h3>}
          <RankTable head={<><th className={`${TH} w-16`}>Rank</th><th className={TH}>Woreda</th><th className={TH}>{list[0].team_name} achievement</th><th className={`${TH} text-right`}>Items</th></>}>
            {[...list].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.woreda_name.localeCompare(b.woreda_name)).map((r) => (
              <tr key={r.woreda_id}>
                <td className="px-3 py-3"><RankBadge rank={r.rank} /></td>
                <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{r.woreda_name}</td>
                <td className="px-3 py-3"><AchievementBar value={r.achievement} /></td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.items}</td>
              </tr>
            ))}
          </RankTable>
        </section>
      ))}
    </div>
  );
}
