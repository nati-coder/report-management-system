import Badge from '../common/Badge.jsx';
const TONE = { draft: 'gray', submitted: 'blue', reviewing: 'amber', approved: 'green', rejected: 'red' };
export default function ReportStatusBadge({ status }) {
  return <Badge tone={TONE[status] || 'gray'}>{status}</Badge>;
}
