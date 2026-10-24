-- ============================================================================
-- Migration: 0006_woreda_approval.sql
--
-- A woreda's team reports are approved by the Woreda Plan Expert BEFORE the
-- woreda submits to the zone. New report statuses (reports.status is a free
-- varchar, so nothing to alter there):
--   pending_woreda   a team member submitted; waiting for the woreda plan expert
--   woreda_approved  the woreda plan expert approved it; waiting for the woreda's other team reports
-- When every team report of the woreda for that period is approved, they are all
-- moved to 'submitted' at once (that is the woreda's submission to the zone).
-- ============================================================================
BEGIN;

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS woreda_approved_by integer REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS woreda_approved_at timestamp without time zone;

CREATE INDEX IF NOT EXISTS idx_reports_period ON public.reports USING btree (format_id, year, month, woreda_id);

COMMIT;
