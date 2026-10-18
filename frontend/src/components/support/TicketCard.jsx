import Badge from '../common/Badge.jsx';
import Card from '../common/Card.jsx';
import { formatDate } from '../../utils/formatters.js';

const PRIORITY = { low: 'gray', medium: 'amber', high: 'red' };
const STATUS = { pending: 'gray', assigned: 'blue', in_progress: 'amber', resolved: 'green', closed: 'purple' };

export default function TicketCard({ ticket, actions }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{ticket.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ticket.description}</p>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {ticket.requester_name} · {formatDate(ticket.created_at)}{ticket.expert_name ? ` · Expert: ${ticket.expert_name}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={PRIORITY[ticket.priority]}>{ticket.priority}</Badge>
          <Badge tone={STATUS[ticket.status]}>{ticket.status}</Badge>
        </div>
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
