export const STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Allowed transitions in the report pipeline */
export const TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['reviewing'],
  reviewing: ['approved', 'rejected'],
  rejected: ['draft'], // creator may revise and resubmit
  approved: [],
};

export const SUPPORT_STATUS = Object.freeze({
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});
