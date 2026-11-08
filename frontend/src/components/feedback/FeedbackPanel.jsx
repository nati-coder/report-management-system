import { useState } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import useFetch from '../../hooks/useFetch.js';
import * as feedbackService from '../../services/feedbackService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { formatDate } from '../../utils/formatters.js';
import { ROLES } from '../../utils/roleHelpers.js';

/** Roles that may write each kind of feedback (the server decides too; this only hides the form). The admin may write all. */
export const FEEDBACK_WRITERS = {
  woreda_report: [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.ADMIN],
  woreda_plan: [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.ADMIN],
  zone_plan: [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.ADMIN],
  department_report: [ROLES.ZONAL_DEPT_HEAD, ROLES.ADMIN],
};

const ROLE_LABEL = {
  admin: 'Admin', zonal_dept_head: 'Zonal Dept Head', zonal_expert: 'Zonal Expert', zonal_team_leader: 'Zonal Team Leader',
  zonal_plan_expert: 'Zonal Plan Expert',
};

/**
 * The written feedback on one subject (see services/feedbackService.js for the kinds and their params), newest first,
 * with a box to add more for those who may write it. There is no score — feedback is text only.
 *   params     the query for the subject: { kind, ... }
 *   role       the signed-in user's role (decides whether the box is shown)
 *   writable   false when it can be read but not added to yet (e.g. a report not under review)
 *   enabled    false while the subject is not chosen yet / can't take feedback; `note` says why
 */
export default function FeedbackPanel({ title = 'Feedback', params, role, enabled = true, writable = true, note, hint, className = '' }) {
  const { success, error } = useNotify();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const canWrite = writable && (FEEDBACK_WRITERS[params.kind] || []).includes(role);
  const key = JSON.stringify(params);
  const { data: items, loading, error: loadError, reload } = useFetch(
    () => (enabled ? feedbackService.list(params) : Promise.resolve([])), [key, enabled]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await feedbackService.add({ ...params, body });
      success('Feedback saved'); setBody(''); reload();
    } catch (err) { error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Card title={title} className={`print:hidden ${className}`}>
      {hint && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {!enabled ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{note}</p>
      ) : (
        <>
          {canWrite && (
            <form onSubmit={submit} className="mb-4 space-y-2">
              <label className="label" htmlFor={`fb-${key}`}>Add feedback</label>
              <textarea id={`fb-${key}`} className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your feedback…" />
              <Button type="submit" loading={busy} disabled={!body.trim()}>Save feedback</Button>
            </form>
          )}
          {loading && !items ? <p className="text-sm text-slate-500">Loading…</p>
            : loadError ? <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
              : !items?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No feedback yet.</p>
                : (
                  <ul className="space-y-3">
                    {items.map((f) => (
                      <li key={f.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                        <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">{f.body}</p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{f.author_name || 'Unknown'} · {ROLE_LABEL[f.author_role] || f.author_role} · {formatDate(f.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
        </>
      )}
    </Card>
  );
}
