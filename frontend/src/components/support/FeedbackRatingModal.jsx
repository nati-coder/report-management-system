import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import * as supportService from '../../services/supportService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

export default function FeedbackRatingModal({ open, ticket, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const { success, error } = useNotify();

  const submit = async () => {
    setBusy(true);
    try { await supportService.feedback(ticket.id, { rating, comment }); success('Thanks for your feedback'); onDone?.(); onClose(); }
    catch (e) { error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Rate the support you received"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!rating} onClick={submit}>Submit</Button></>}>
      <div className="mb-4 flex gap-1 text-3xl" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}
            className={n <= rating ? 'text-amber-400' : 'text-slate-300'}>★</button>
        ))}
      </div>
      <textarea className="input" rows={3} placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
    </Modal>
  );
}
