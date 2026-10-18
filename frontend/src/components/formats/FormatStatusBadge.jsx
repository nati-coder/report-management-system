import Badge from '../common/Badge.jsx';

const TONE = { draft: 'gray', pending_approval: 'amber', approved: 'green', rejected: 'red' };

export default function FormatStatusBadge({ status }) {
  return <Badge tone={TONE[status] || 'gray'}>{status?.replace('_', ' ')}</Badge>;
}
