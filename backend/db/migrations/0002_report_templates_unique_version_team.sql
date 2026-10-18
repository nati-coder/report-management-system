-- ============================================================================
-- Migration: 0002_report_templates_unique_version_team.sql
--
-- Enforces "one report template per (report version, team)" at the database
-- level. The application already checks this before insert/update
-- (templateController.createTemplate), but that check-then-insert has a
-- narrow race-condition window under concurrent requests — this constraint
-- is what actually closes it.
--
-- SAFETY: if any duplicate (version_id, team_id) pairs already exist, this
-- migration deliberately ABORTS with a clear error rather than silently
-- deleting rows to make room for the constraint. If it aborts, resolve the
-- listed duplicates manually (decide which row to keep per pair), then
-- re-run `npm run migrate`.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  dupe_count integer;
BEGIN
  SELECT COUNT(*) INTO dupe_count FROM (
    SELECT version_id, team_id
    FROM public.report_templates
    GROUP BY version_id, team_id
    HAVING COUNT(*) > 1
  ) d;

  IF dupe_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE(version_id, team_id) to report_templates: % (version_id, team_id) pair(s) already have more than one template. Resolve them manually (merge or delete the extras), then re-run the migration. Query to find them: SELECT version_id, team_id, COUNT(*), array_agg(id) FROM report_templates GROUP BY version_id, team_id HAVING COUNT(*) > 1;',
      dupe_count;
  END IF;
END $$;

ALTER TABLE public.report_templates
  ADD CONSTRAINT report_templates_version_team_unique UNIQUE (version_id, team_id);

COMMIT;
