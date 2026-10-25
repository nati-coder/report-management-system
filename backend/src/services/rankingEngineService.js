import Ranking from '../models/Ranking.js';
import { monthsOf } from '../utils/periods.js';

/** Weights sum to 1. Timeliness / accuracy (approval rate) / quality (expert scoring). */
export const WEIGHTS = { timeliness: 0.4, accuracy: 0.3, quality: 0.3 };

/** 100 if on time, minus 10 points per late day (floor 0) */
const timelinessScore = (avgDaysLate) => (avgDaysLate === null ? 0 : Math.max(0, 100 - avgDaysLate * 10));
const accuracyScore = (m) => (m.total_reports ? (m.approved_reports / m.total_reports) * 100 : 0);
const qualityScore = (m) => (m.avg_quality === null || m.avg_quality === undefined ? 0 : Number(m.avg_quality));

export async function computeTeamRanking(period) {
  const metrics = await Ranking.teamMetrics({ ...period, months: monthsOf(period) });
  const scored = metrics.map((m) => {
    const t = timelinessScore(m.avg_days_late === null ? null : Number(m.avg_days_late));
    const a = accuracyScore(m);
    const q = qualityScore(m);
    return {
      team_id: m.team_id,
      total_score: Math.round((t * WEIGHTS.timeliness + a * WEIGHTS.accuracy + q * WEIGHTS.quality) * 100) / 100,
      breakdown: { timeliness: t, accuracy: a, quality: q },
    };
  });
  scored.sort((x, y) => y.total_score - x.total_score);
  // standard competition ranking (ties share a rank)
  let prev = null; let rank = 0;
  scored.forEach((s, i) => {
    if (s.total_score !== prev) { rank = i + 1; prev = s.total_score; }
    s.rank = rank;
  });
  await Ranking.replaceTeamRanking(period, scored);
  return scored;
}
