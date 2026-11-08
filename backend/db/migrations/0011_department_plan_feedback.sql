-- ============================================================================
-- Migration: 0011_department_plan_feedback.sql
-- A new feedback kind: department_plan — the Zonal Dept Head's feedback on the zone plan of the WHOLE department
-- (all teams at once, not per team) for a period (period = annual | m7 …).
-- ============================================================================
BEGIN;
ALTER TABLE public.review_feedback DROP CONSTRAINT IF EXISTS review_feedback_kind_check;
ALTER TABLE public.review_feedback ADD CONSTRAINT review_feedback_kind_check
  CHECK (kind IN ('woreda_report', 'woreda_plan', 'zone_plan', 'department_report', 'department_plan'));
COMMIT;
