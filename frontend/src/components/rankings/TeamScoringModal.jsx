import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as rankingService from '../../services/rankingService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

/** Score a submitted report: timeliness/accuracy/quality are derived server-side; the reviewer provides the quality score. */
export default function TeamScoringModal({ open, report, onClose, onScored }) {
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  const save = async () => {
    setBusy(true);
    try {
      await rankingService.scoreReport({ report_id: report.id, score: Number(score), max_score: 100, feedback });
      success('Score recorded'); onScored?.(); onClose();
    } catch (e) { error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Score: ${report?.title ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={score === ''} onClick={save}>Save score</Button></>}>
      <label className="label">Quality score (0–100)</label>
      <input className="input mb-3" type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} />
      <label className="label">Feedback</label>
      <textarea className="input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
    </Modal>
  );
}
