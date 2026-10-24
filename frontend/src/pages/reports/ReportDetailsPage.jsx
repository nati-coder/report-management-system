import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Loader from '../../components/common/Loader.jsx';
import DynamicReportForm from '../../components/reports/DynamicReportForm.jsx';
import ReportStatusBadge from '../../components/reports/ReportStatusBadge.jsx';
import TeamScoringModal from '../../components/rankings/TeamScoringModal.jsx';
import useFetch from '../../hooks/useFetch.js';
import useAuth from '../../hooks/useAuth.js';
import * as reportService from '../../services/reportService.js';
import * as reportFormatService from '../../services/reportFormatService.js';
import * as planService from '../../services/planService.js';
import { errorMessage } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { isWoredaUser, isZonalUser, ROLES, WOREDA_ROLES } from '../../utils/roleHelpers.js';
import { formatDate } from '../../utils/formatters.js';
import * as reportWindowService from '../../services/reportWindowService.js';
import { monthName as nameOfMonth, fmtDateTime, timeLeft } from '../../utils/periods.js';

export default function ReportDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { success, error } = useNotify();
  const { data: report, loading, reload } = useFetch(() => reportService.get(id), [id]);
  const { data: format } = useFetch(() => (report?.format_id ? reportFormatService.get(report.format_id) : Promise.resolve(null)), [report?.format_id]);
  // The woreda's accepted annual plan for this report's format + year: its targets are what is reported against.
  const { data: plans, loading: plansLoading } = useFetch(
    () => (report?.format_id ? planService.list({ format_id: report.format_id, year: report.year, status: 'approved' }) : Promise.resolve([])), [report?.format_id, report?.year]);
  // A monthly report is read against that month's plan (once the zone has cascaded it), not just the annual one.
  const { data: monthlyPlans, loading: monthlyLoading } = useFetch(
    () => (report?.format_id && report?.type === 'monthly' && report?.month ? planService.listMonthly({ format_id: report.format_id, year: report.year }) : Promise.resolve([])), [report?.id]);
  // The reporting period of a monthly report: it can only be edited and submitted between its opening time and deadline.
  const { data: periods, loading: periodsLoading } = useFetch(
    () => (report?.format_id && report?.type === 'monthly' && report?.month ? reportWindowService.list({ format_id: report.format_id, year: report.year }) : Promise.resolve([])), [report?.id]);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);

  if (loading || !report || plansLoading || monthlyLoading || periodsLoading) return <Loader />;
  const plan = (plans || []).find((p) => p.woreda_id === report.woreda_id && !p.month && !p.quarter) || null;

  const monthName = report.month ? nameOfMonth(report.month) : '';
  const period = (periods || []).find((w) => w.month === report.month) || null;
  const isMonthly = report.type === 'monthly' && !!report.format_id;
  const monthPlan = (monthlyPlans || []).find((p) => p.woreda_id === report.woreda_id && p.month === report.month && ['submitted', 'approved'].includes(p.status)) || null;

  const periodOpen = !isMonthly || period?.state === 'open';
  const editable = isWoredaUser(user) && ['draft', 'rejected'].includes(report.status) && periodOpen && (!isMonthly || !!monthPlan);
  const canSubmit = editable && report.status === 'draft' && WOREDA_ROLES.includes(user.role);
  const canReview = isZonalUser(user) || user.role === ROLES.ADMIN;
  // The woreda plan expert approves each team report; the woreda submits to the zone when all of them are approved.
  const isWoredaPlanExpert = user.role === ROLES.WOREDA_PLAN_EXPERT || user.role === ROLES.ADMIN;

  const run = async (fn, msg) => { try { await fn(); success(msg); reload(); } catch (e) { error(errorMessage(e)); } };
  const save = async (data) => { setSaving(true); await run(() => reportService.update(id, { data }), 'Draft saved'); setSaving(false); };
  const review = (action) => {
    let feedback;
    if (action === 'reject') { feedback = window.prompt('Reason for rejection (required):'); if (!feedback) return; }
    run(() => reportService.review(id, { action, feedback }), `Report ${action}`);
  };

  const woredaReview = async (action) => {
    let feedback;
    if (action === 'reject') { feedback = window.prompt('Reason for sending it back (required):'); if (!feedback) return; }
    try { const r = await reportService.woredaReview(id, { action, feedback }); success(action === 'reject' ? 'Report sent back to its author'
      : r?.forwarded ? 'Approved — every team report is in, so the woreda has submitted to the zone'
        : r?.waiting ? `Approved — waiting for ${r.waiting} more team report${r.waiting > 1 ? 's' : ''} before the woreda submits` : 'Approved'); reload(); } catch (e) { error(errorMessage(e)); }
  };

  return (
    <>
      <Header title={report.title} subtitle={`${report.woreda_name} · ${format?.team_name ? `${format.team_name} · ` : ''}${report.type} · ${report.year}${monthName ? ` · ${monthName}` : report.quarter ? ` · Q${report.quarter}` : ''}`}
        actions={<ReportStatusBadge status={report.status} />} />
      {report.feedback && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Reviewer feedback: {report.feedback}</p>}
      {report.status === 'pending_woreda' && <p className="mb-4 rounded-lg bg-purple-50 p-3 text-sm text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">Waiting for the woreda plan expert. The woreda submits to the zone once every team's report is approved.</p>}
      {report.status === 'woreda_approved' && <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Approved by the woreda plan expert. It reaches the zone together with the woreda's other team reports.</p>}
      {isMonthly && period && (
        <p className={`mb-4 rounded-lg p-3 text-sm ${period.state === 'open' ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
          {period.state === 'open' && `${monthName} reporting is open until ${fmtDateTime(period.closes_at)} (${timeLeft(period.closes_at)}).`}
          {period.state === 'closed' && `${monthName} reporting closed on ${fmtDateTime(period.closes_at)}${isWoredaUser(user) && ['draft', 'rejected'].includes(report.status) ? ' — this report can no longer be edited or submitted unless the zone extends the deadline.' : '.'}`}
          {period.state === 'upcoming' && `${monthName} reporting opens on ${fmtDateTime(period.opens_at)}.`}
        </p>
      )}
      {isMonthly && !period && isWoredaUser(user) && ['draft', 'rejected'].includes(report.status) && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{monthName} is not open for reporting, so this report can't be edited or submitted.</p>
      )}
      {isMonthly && !monthPlan && isWoredaUser(user) && ['draft', 'rejected'].includes(report.status) && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          There is no monthly plan for {monthName} yet, so this report can't be filled in until the Zonal Expert cascades it.
        </p>
      )}
      {editable && report.format_id && !plan && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          There is no accepted annual plan for this report's format and year, so it can't be saved until the woreda has accepted one.
        </p>
      )}
      <Card title="Report data" actions={<span className="text-xs text-slate-400 dark:text-slate-500">Submitted: {formatDate(report.submitted_at)}</span>}>
        <DynamicReportForm key={report.updated_at} schema={format?.schema_definition} plan={isMonthly ? (monthPlan?.data ?? null) : (plan?.data ?? null)}
          planLabel={isMonthly ? `Plan (${monthName})` : 'Plan (annual)'} initialData={report.data || {}} readOnly={!editable} saving={saving} onSave={save} />
      </Card>
      <div className="mt-4 flex flex-wrap gap-3">
        {canSubmit && <Button onClick={() => run(() => reportService.submit(id), 'Report submitted')}>{user.role === ROLES.WOREDA_PLAN_EXPERT ? 'Submit' : 'Submit for approval'}</Button>}
        {isWoredaPlanExpert && report.status === 'pending_woreda' && <Button onClick={() => woredaReview('approve')}>Approve</Button>}
        {isWoredaPlanExpert && ['pending_woreda', 'woreda_approved'].includes(report.status) && <Button variant="danger" onClick={() => woredaReview('reject')}>Send back</Button>}
        {canReview && report.status === 'submitted' && <Button onClick={() => review('start_review')}>Start review</Button>}
        {canReview && report.status === 'reviewing' && <>
          <Button onClick={() => review('approve')}>Approve</Button>
          <Button variant="danger" onClick={() => review('reject')}>Reject</Button>
        </>}
        {canReview && ['reviewing', 'approved'].includes(report.status) && <Button variant="secondary" onClick={() => setScoring(true)}>Score team</Button>}
      </div>
      <TeamScoringModal open={scoring} report={report} onClose={() => setScoring(false)} />
    </>
  );
}
