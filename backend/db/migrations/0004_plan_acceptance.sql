-- ============================================================================
-- Migration: 0004_plan_acceptance.sql
--
-- A woreda accepts or rejects the annual plan cascaded to it. Acceptance reuses
-- plans.status ('submitted' -> 'approved' | 'rejected') and approved_by/approved_at;
-- a rejection needs a reason the zonal expert can read, so add that column.
-- (fn_set_row_hash hashes to_jsonb(NEW), so the new column is covered automatically.)
-- ============================================================================
BEGIN;

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMIT;
