export const STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_WOREDA: 'pending_woreda', // a team member submitted; the woreda plan expert has not approved it yet
  WOREDA_APPROVED: 'woreda_approved', // approved by the woreda plan expert; waiting for the woreda's other team reports
  SUBMITTED: 'submitted',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Statuses the zone never sees: still inside the woreda (a woreda's reports reach the zone together, as 'submitted'). */
export const WOREDA_ONLY = ['draft', 'pending_woreda', 'woreda_approved'];
/** Statuses that mean the report has reached the zone. */
export const WITH_ZONE = ['submitted', 'reviewing', 'approved'];

/** Allowed transitions in the report pipeline */
export const TRANSITIONS = {
  draft: ['pending_woreda', 'submitted'], // 'submitted' directly only for reports without a report format (legacy)
  pending_woreda: ['woreda_approved', 'rejected'],
  woreda_approved: ['rejected'], // the woreda plan expert may still send it back until the whole woreda is submitted
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
