import { useMemo } from 'react';

/**
 * Two-step choice of a report format: first the year, then — among the formats of that year — the version.
 * Controlled: the parent owns `year` and `formatId` (strings). Picking another year clears the format.
 *
 *   allOptions  optional [{ value, label }] shown first in the version list — one per report version of the year
 *               ("<version> — all teams"); the year decides which versions exist, so a new year clears the choice
 *
 * Renders its own grid cells, so put it inside a grid.
 */
export default function YearFormatSelect({
  formats, year, setYear, formatId, setFormatId, allOptions, idPrefix = 'fmt', versionLabel = 'Report version', yearLabel = 'Year', yearClass = '', versionClass = 'md:col-span-2',
}) {
  const years = useMemo(() => [...new Set((formats || []).map((f) => String(f.version_year)))].sort((a, b) => Number(b) - Number(a)), [formats]);
  const inYear = useMemo(() => (formats || []).filter((f) => String(f.version_year) === String(year)), [formats, year]);

  const pickYear = (y) => {
    setYear(y);
    setFormatId('');
  };

  return (
    <>
      <div className={yearClass}>
        <label className="label" htmlFor={`${idPrefix}-year`}>{yearLabel}</label>
        <select id={`${idPrefix}-year`} className="input" value={year} onChange={(e) => pickYear(e.target.value)}>
          <option value="">Select year…</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className={versionClass}>
        <label className="label" htmlFor={`${idPrefix}-version`}>{versionLabel}</label>
        <select id={`${idPrefix}-version`} className="input" value={formatId} disabled={!year} onChange={(e) => setFormatId(e.target.value)}>
          <option value="">{year ? 'Select…' : 'Choose a year first'}</option>
          {(allOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {inYear.map((f) => <option key={f.id} value={f.id}>{f.version_name} — {f.template_title} · {f.team_name || 'no team'} (v{f.version}, {f.template_type})</option>)}
        </select>
        {!!year && !inYear.length && !allOptions?.length && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No approved report format for {year}.</p>}
      </div>
    </>
  );
}
