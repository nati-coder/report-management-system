/** Value prefix of the version select's "whole version" entries (every team of one report version at once). */
export const ALL_PREFIX = 'all:';
export const isAllValue = (v) => typeof v === 'string' && v.startsWith(ALL_PREFIX);
export const versionIdOf = (v) => (isAllValue(v) ? v.slice(ALL_PREFIX.length) : '');

/** One "<version name> — all teams" entry for each report version that the formats of the year belong to. */
export function wholeVersionOptions(formats, year) {
  const seen = new Map();
  for (const f of formats || []) if (String(f.version_year) === String(year) && !seen.has(f.version_id)) seen.set(f.version_id, f.version_name);
  return [...seen].map(([id, name]) => ({ value: `${ALL_PREFIX}${id}`, label: `${name} — all teams in one table` }));
}
