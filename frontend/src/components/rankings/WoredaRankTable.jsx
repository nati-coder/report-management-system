import { useState } from 'react';
import Table from '../common/Table.jsx';
import Button from '../common/Button.jsx';
import * as rankingService from '../../services/rankingService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { localName } from '../../utils/formatters.js';

/** Manual ranking matrix for Plan Experts: assign a rank + feedback per woreda. */
export default function WoredaRankTable({ woredas, existing = [], year, periodType, editable, onSaved }) {
  const seed = Object.fromEntries(existing.map((r) => [r.woreda_id, { rank: r.overall_rank, feedback: r.manual_feedback || '' }]));
  const [draft, setDraft] = useState(seed);
  const { success, error } = useNotify();
  const upd = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async (w) => {
    const row = draft[w.woreda_id];
    if (!row?.rank) return error('Enter a rank first');
    try {
      await rankingService.setWoredaRank({ woreda_id: w.woreda_id, year, period_type: periodType, overall_rank: Number(row.rank), manual_feedback: row.feedback });
      success(`${w.name}: rank saved`); onSaved?.();
    } catch (e) { error(errorMessage(e)); }
  };

  const columns = [
    { key: 'name', header: 'Woreda', render: (w) => localName(w) },
    { key: 'rank', header: 'Rank', render: (w) => editable
      ? <input type="number" min="1" className="input w-20" value={draft[w.woreda_id]?.rank ?? ''} onChange={(e) => upd(w.woreda_id, { rank: e.target.value })} />
      : draft[w.woreda_id]?.rank ?? '—' },
    { key: 'feedback', header: 'Feedback', render: (w) => editable
      ? <input className="input" value={draft[w.woreda_id]?.feedback ?? ''} onChange={(e) => upd(w.woreda_id, { feedback: e.target.value })} />
      : draft[w.woreda_id]?.feedback || '—' },
    ...(editable ? [{ key: 'act', header: '', render: (w) => <Button onClick={() => save(w)}>Save</Button> }] : []),
  ];
  return <Table columns={columns} rows={woredas.map((w) => ({ ...w, id: w.woreda_id }))} />;
}
