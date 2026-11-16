import { RankBadge, AchievementBar, RankTable, Breakdown, TH } from './RankParts.jsx';

/** Zonal team rank: each team's achievement is the average of that team across the woredas of the zone. */
export default function ZonalTeamTable({ rows }) {
  return (
    <RankTable head={<><th className={`${TH} w-16`}>Rank</th><th className={TH}>Team</th><th className={TH}>Achievement</th><th className={`${TH} text-right`}>Woredas</th></>}>
      {rows.map((r) => (
        <tr key={r.team_id}>
          <td className="px-3 py-3 align-top"><RankBadge rank={r.rank} /></td>
          <td className="px-3 py-3 align-top">
            <div className="font-medium text-slate-900 dark:text-slate-100">{r.team_name}</div>
            <Breakdown label="Average across woredas" parts={(r.woredas || []).map((w) => ({ key: w.woreda_id, name: w.woreda_name, achievement: w.achievement }))} />
          </td>
          <td className="px-3 py-3 align-top"><AchievementBar value={r.achievement} /></td>
          <td className="px-3 py-3 text-right align-top tabular-nums text-slate-500 dark:text-slate-400">{r.woredas_counted} / {r.woredas_total}</td>
        </tr>
      ))}
    </RankTable>
  );
}
