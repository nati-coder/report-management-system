import Ranking from '../models/Ranking.js';
import { monthsOf } from '../utils/periods.js';

/**
 * Weights sum to 1. Timeliness / accuracy (approval rate) / quality (legacy expert scores in team_feedback). Reviewers now
 * give written feedback instead of a score, so when no team has a quality score its weight is shared out between the
 * other two (see weightsFor) rather than capping every team at 70.
 */
export const WEIGHTS = { timeliness: 0.4, accuracy: 0.3, quality: 0.3 };

/** 100 if on time, minus 10 points per late day (floor 0) */
const timelinessScore = (avgDaysLate) => (avgDaysLate === null ? 0 : Math.max(0, 100 - avgDaysLate * 10));
const accuracyScore = (m) => (m.total_reports ? (m.approved_reports / m.total_reports) * 100 : 0);
const qualityScore = (m) => (m.avg_quality === null || m.avg_quality === undefined ? 0 : Number(m.avg_quality));

/** The weights to use: the quality weight is shared out proportionally when nobody has a quality score. */
export function weightsFor(metrics) {
  if (metrics.some((m) => m.avg_quality !== null && m.avg_quality !== undefined)) return WEIGHTS;
  const rest = WEIGHTS.timeliness + WEIGHTS.accuracy;
  return { timeliness: WEIGHTS.timeliness / rest, accuracy: WEIGHTS.accuracy / rest, quality: 0 };
}

export async function computeTeamRanking(period) {
  const metrics = await Ranking.teamMetrics({ ...period, months: monthsOf(period) });
  const W = weightsFor(metrics);
  const scored = metrics.map((m) => {
    const t = timelinessScore(m.avg_days_late === null ? null : Number(m.avg_days_late));
    const a = accuracyScore(m);
    const q = qualityScore(m);
    return {
      team_id: m.team_id,
      total_score: Math.round((t * W.timeliness + a * W.accuracy + q * W.quality) * 100) / 100,
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
