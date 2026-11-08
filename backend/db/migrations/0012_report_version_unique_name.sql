-- ============================================================================
-- Migration: 0012_report_version_unique_name.sql
-- The same report version can't exist twice in the same year: one department can't have two versions with the same
-- name in a year, ignoring letter case and surrounding spaces ("v1.0" = " V1.0 "). The old constraint only caught exact matches.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.report_versions GROUP BY dep_id, year, lower(btrim(name)) HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Cannot enforce one report version per name and year: duplicates exist. Find them with: SELECT dep_id, year, lower(btrim(name)), array_agg(id) FROM report_versions GROUP BY 1,2,3 HAVING COUNT(*) > 1; then rename or delete the extras and re-run.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS report_versions_dep_year_name_ci_unique
  ON public.report_versions (dep_id, year, lower(btrim(name)));
