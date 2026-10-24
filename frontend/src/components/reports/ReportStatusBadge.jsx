import Badge from '../common/Badge.jsx';
export const STATUS_TONE = { draft: 'gray', pending_woreda: 'purple', woreda_approved: 'blue', submitted: 'blue', reviewing: 'amber', approved: 'green', rejected: 'red' };
export const STATUS_LABEL = { pending_woreda: 'awaiting woreda approval', woreda_approved: 'approved by woreda' };
export const statusLabel = (s) => STATUS_LABEL[s] || s;
export default function ReportStatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'gray'}>{statusLabel(status)}</Badge>;
}
