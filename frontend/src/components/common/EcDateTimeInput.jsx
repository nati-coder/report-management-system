import { useEffect, useState } from 'react';
import { EC_MONTHS, ecParts, ecToDate, ecDaysInMonth, gregorianWall, fromGregorianWall } from '../../utils/ethiopianDate.js';

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm' (Addis Ababa wall clock) → { y, m, d, time } as an Ethiopian date, or null. */
function parse(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value || '');
  if (!m) return null;
  const p = ecParts(fromGregorianWall(+m[1], +m[2], +m[3], 12, 0));
  return { y: p.year, m: p.month, d: p.day, time: `${pad(m[4] ?? 9)}:${pad(m[5] ?? 0)}` };
}

/** Ethiopian date (+ optional time) → the same text a native <input> would give: 'YYYY-MM-DD[THH:mm]'. */
function serialise({ y, m, d, time }, withTime) {
  const [hh, mi] = (time || '00:00').split(':').map(Number);
  const dt = ecToDate(y, m, Math.min(d, ecDaysInMonth(y, m)), hh || 0, mi || 0);
  if (!dt) return '';
  const g = gregorianWall(dt);
  const day = `${g.year}-${pad(g.month)}-${pad(g.day)}`;
  return withTime ? `${day}T${pad(g.hour)}:${pad(g.minute)}` : day;
}

/**
 * Ethiopian-calendar date (and time) picker. `value` / `onChange` use the same text as <input type="date"> or
 * <input type="datetime-local"> ('YYYY-MM-DD' / 'YYYY-MM-DDTHH:mm', Addis Ababa time), so the API and the
 * database are untouched — only what the person sees and picks is Ethiopian.
 */
export default function EcDateTimeInput({ value, onChange, withTime = true, disabled = false, required = false, id }) {
  const [sel, setSel] = useState(() => parse(value) || { y: '', m: '', d: '', time: '09:00' });

  // Follow the parent when it changes the value (reset, loading a saved period …).
  useEffect(() => {
    const p = parse(value);
    if (p) setSel(p); else if (!value) setSel((s) => ({ y: '', m: '', d: '', time: s.time }));
  }, [value]);

  const nowYear = ecParts(new Date()).year;
  const years = [];
  for (let y = nowYear - 5; y <= nowYear + 5; y += 1) years.push(y);
  if (sel.y && !years.includes(sel.y)) years.push(sel.y);
  const days = sel.y && sel.m ? ecDaysInMonth(sel.y, sel.m) : 30;

  const update = (patch) => {
    const next = { ...sel, ...patch };
    if (next.y && next.m && next.d > ecDaysInMonth(next.y, next.m)) next.d = ecDaysInMonth(next.y, next.m);
    setSel(next);
    if (next.y && next.m && next.d) onChange(serialise(next, withTime));
    else if (!next.y && !next.m && !next.d) onChange('');
  };
  const num = (v) => (v === '' ? '' : Number(v));
  const auto = { style: { width: 'auto' } };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select id={id} className="input" {...auto} disabled={disabled} required={required} aria-label="Month" value={sel.m} onChange={(e) => update({ m: num(e.target.value) })}>
        <option value="">Month</option>
        {EC_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select className="input" {...auto} disabled={disabled} required={required} aria-label="Day" value={sel.d} onChange={(e) => update({ d: num(e.target.value) })}>
        <option value="">Day</option>
        {Array.from({ length: days }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select className="input" {...auto} disabled={disabled} required={required} aria-label="Year (EC)" value={sel.y} onChange={(e) => update({ y: num(e.target.value) })}>
        <option value="">Year (EC)</option>
        {years.sort((a, b) => a - b).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      {withTime && <input type="time" className="input" {...auto} disabled={disabled} required={required} aria-label="Time" value={sel.time} onChange={(e) => update({ time: e.target.value })} />}
    </div>
  );
}
