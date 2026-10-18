import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Loader from '../../components/common/Loader.jsx';
import Button from '../../components/common/Button.jsx';
import TicketCard from '../../components/support/TicketCard.jsx';
import FeedbackRatingModal from '../../components/support/FeedbackRatingModal.jsx';
import useSupport from '../../hooks/useSupport.js';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as supportService from '../../services/supportService.js';
import api, { unwrap, errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';

export default function SupportListPage() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const { data, loading, reload } = useSupport();
  const [rating, setRating] = useState(null);
  const isHead = [ROLES.ZONAL_DEPT_HEAD, ROLES.ADMIN].includes(user.role);
  const isExpert = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT].includes(user.role);
  const { data: experts } = useFetch(() => (isHead ? unwrap(api.get('/users', { params: { limit: 200 } })) : Promise.resolve([])), [isHead]);
  const expertList = (experts || []).filter((u) => [ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT].includes(u.role));

  const run = async (fn, msg) => { try { await fn(); success(msg); reload(); } catch (e) { error(errorMessage(e)); } };

  const actionsFor = (t) => (
    <>
      {isHead && t.status === 'pending' && (
        <select className="input w-56" defaultValue="" onChange={(e) => e.target.value && run(() => supportService.assign(t.id, Number(e.target.value)), 'Expert assigned')}>
          <option value="">Assign expert…</option>{expertList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      {(isHead || isExpert) && t.status === 'assigned' && <Button variant="secondary" onClick={() => run(() => supportService.setStatus(t.id, 'in_progress'), 'Started')}>Start</Button>}
      {(isHead || isExpert) && t.status === 'in_progress' && <Button onClick={() => run(() => supportService.setStatus(t.id, 'resolved'), 'Marked resolved')}>Mark resolved</Button>}
      {user.role === ROLES.WOREDA_DEPT_HEAD && t.status === 'resolved' && <Button onClick={() => setRating(t)}>Rate support</Button>}
    </>
  );

  return (
    <>
      <Header title="Support requests" actions={user.role === ROLES.WOREDA_DEPT_HEAD && <Link to="/support/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">New request</Link>} />
      {loading ? <Loader /> : (
        <div className="space-y-3">
          {data?.length ? data.map((t) => <TicketCard key={t.id} ticket={t} actions={actionsFor(t)} />) : <p className="text-slate-400 dark:text-slate-500">No support requests.</p>}
        </div>
      )}
      <FeedbackRatingModal open={!!rating} ticket={rating} onClose={() => setRating(null)} onDone={reload} />
    </>
  );
}
