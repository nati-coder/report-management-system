import { useEffect, useRef, useState } from 'react';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Loader from '../../components/common/Loader.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import WoredaPlanView from '../../components/plans/WoredaPlanView.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as planService from '../../services/planService.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { ROLES } from '../../utils/roleHelpers.js';
import { formatDate } from '../../utils/formatters.js';

const STATUS = {
  submitted: ['awaiting your answer', 'blue'],
  approved: ['accepted', 'green'],
  rejected: ['rejected', 'red'],
};

/**
 * Woreda users: the annual plans cascaded to their woreda (limited to their department / team).
 * The Woreda Dept Head accepts a plan — which locks it — or rejects it with a reason, which sends it
 * back to the Zonal Expert to revise and cascade again. Everyone else can read it.
 */
export default function MyPlansPage() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const canDecide = user.role === ROLES.WOREDA_DEPT_HEAD;

  const { data: plans, loading, error: loadError, reload } = useFetch(() => planService.list(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [format, setFormat] = useState(null);
  const [formatError, setFormatError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const plan = (plans || []).find((p) => p.id === selectedId) || null;
  const detailRef = useRef(null);

  // Opening a plan selects it and brings its details (below the list) into view.
  const open = (id) => {
    setSelectedId(id);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Open the only plan straight away, or the first one waiting for an answer.
  useEffect(() => {
    if (!plans?.length || plans.some((p) => p.id === selectedId)) return;
    setSelectedId((plans.find((p) => p.status === 'submitted') || plans[0]).id);
  }, [plans]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFormat(null); setFormatError('');
    if (!plan) return undefined;
    let live = true;
    reportFormatService.get(plan.format_id).then((f) => live && setFormat(f)).catch((e) => live && setFormatError(`${errorMessage(e)} (${e.response?.status ? `HTTP ${e.response.status}` : 'no response from the server'})`));
    return () => { live = false; };
  }, [plan?.format_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (body, done) => {
    setBusy(true);
    try {
      await planService.review(plan.id, body);
      success(done);
      setRejecting(false); setReason('');
      reload();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  const accept = () => {
    if (!window.confirm(`Accept the ${plan.year} plan for ${plan.template_title}? Once accepted it can't be changed.`)) return;
    decide({ action: 'approve' }, 'Plan accepted');
  };

  if (loading && !plans) return <Loader />;

  return (
    <>
      <Header title="Annual Plans" subtitle="The annual targets the zone has set for your woreda." />
      {loadError && <p className="mb-4 text-red-600">{loadError}</p>}

      {!plans?.length ? (
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">No annual plan has been cascaded to your woreda yet. You'll be notified when one arrives.</p></Card>
      ) : (
        <div className="space-y-6">
          <Card title="Cascaded plans">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr><th className="py-2 pr-3 font-medium">Report format</th><th className="px-3 py-2 font-medium">Team</th><th className="px-3 py-2 font-medium">Year</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Received</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {plans.map((p) => (
                    <tr key={p.id} onClick={() => open(p.id)} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${p.id === selectedId ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}>
                      <td className="py-2 pr-3 font-medium">{p.template_title} <span className="font-normal text-slate-400">(v{p.format_version})</span></td>
                      <td className="px-3 py-2">{p.team_name || '—'}</td>
                      <td className="px-3 py-2">{p.year}</td>
                      <td className="px-3 py-2"><Badge tone={STATUS[p.status]?.[1]}>{STATUS[p.status]?.[0] || p.status}</Badge></td>
                      <td className="px-3 py-2">{formatDate(p.updated_at)}</td>
                      <td className="py-2 pl-3 text-right"><Button type="button" variant={p.id === selectedId ? 'primary' : 'secondary'} onClick={(e) => { e.stopPropagation(); open(p.id); }}>{p.id === selectedId ? 'Viewing' : 'Open'}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {plan && (
            <div ref={detailRef} className="scroll-mt-4">
            <Card
              title={`${plan.template_title} — ${plan.year}`}
              actions={canDecide && plan.status === 'submitted' && (
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>Reject</Button>
                  <Button loading={busy} onClick={accept}>Accept plan</Button>
                </div>
              )}
            >
              {plan.status === 'approved' && (
                <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-400">Accepted on {formatDate(plan.approved_at)}. This plan is now locked.</p>
              )}
              {plan.status === 'rejected' && (
                <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  Rejected{plan.rejection_reason ? `: ${plan.rejection_reason}` : '.'} The zonal expert has been notified and can send a revised plan.
                </p>
              )}
              {plan.status === 'submitted' && !canDecide && (
                <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Waiting for the Woreda Department Head to accept or reject this plan.</p>
              )}
              {formatError ? <p className="text-sm text-red-600">Could not load this plan's report format: {formatError}</p> : !format ? <Loader /> : <WoredaPlanView format={format} data={plan.data} />}
            </Card>
            </div>
          )}
        </div>
      )}

      <Modal
        open={rejecting} title="Reject this plan" onClose={() => !busy && setRejecting(false)}
        footer={(
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => decide({ action: 'reject', rejection_reason: reason.trim() }, 'Plan rejected')}>Reject plan</Button>
          </>
        )}
      >
        <label className="label" htmlFor="reject-reason">Reason (the zonal expert will see this)</label>
        <textarea id="reject-reason" className="input min-h-[7rem]" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
