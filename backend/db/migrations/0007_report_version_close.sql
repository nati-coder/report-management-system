-- ============================================================================
-- Migration: 0007_report_version_close.sql
--
-- A report version is closed MANUALLY by the System Admin (normally at the end
-- of the Ethiopian fiscal year, after Sene). Once closed, no further templates
-- may be created or changed under it, and it is hidden from the report-version
-- list used when creating templates.
--   closed_at IS NULL      -> open
--   closed_at IS NOT NULL  -> closed (closed_by = the admin who closed it)
-- ============================================================================

BEGIN;

ALTER TABLE public.report_versions
  ADD COLUMN IF NOT EXISTS closed_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS closed_by integer REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_report_versions_open ON public.report_versions (dep_id) WHERE closed_at IS NULL;

COMMIT;
