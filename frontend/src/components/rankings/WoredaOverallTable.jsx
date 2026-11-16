import { RankBadge, AchievementBar, RankTable, Breakdown, TH } from './RankParts.jsx';

/** Overall woreda rank (department level): each woreda's achievement is the average of its teams. */
export default function WoredaOverallTable({ rows }) {
  return (
    <RankTable head={<><th className={`${TH} w-16`}>Rank</th><th className={TH}>Woreda</th><th className={TH}>Achievement</th><th className={`${TH} text-right`}>Teams</th></>}>
      {rows.map((r) => (
        <tr key={r.woreda_id}>
          <td className="px-3 py-3 align-top"><RankBadge rank={r.rank} /></td>
          <td className="px-3 py-3 align-top">
            <div className="font-medium text-slate-900 dark:text-slate-100">{r.woreda_name}</div>
            <Breakdown label="Average of its teams" parts={(r.teams || []).map((t) => ({ key: t.team_id, name: t.team_name, achievement: t.achievement }))} />
          </td>
          <td className="px-3 py-3 align-top"><AchievementBar value={r.achievement} /></td>
          <td className="px-3 py-3 text-right align-top tabular-nums text-slate-500 dark:text-slate-400">{r.teams_counted} / {r.teams_total}</td>
        </tr>
      ))}
    </RankTable>
  );
}
