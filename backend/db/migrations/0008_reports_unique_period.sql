-- ============================================================================
-- Migration: 0008_reports_unique_period.sql
--
-- "One report per woreda, report format and period" used to be enforced only by a
-- check-then-insert in the API, so two simultaneous requests could both pass it.
-- These partial unique indexes make the database the real guard (the API turns the
-- violation into a friendly 409). Reports without a format (legacy) are not covered.
--
--   monthly   (format, woreda, year, month)
--   quarterly (format, woreda, year, quarter)   -- month is NULL
--   annual    (format, woreda, year)            -- month and quarter are NULL
--
-- If duplicates already exist the migration stops and tells you how to find them;
-- keep the one you want, delete or merge the others, then run `npm run migrate` again.
-- ============================================================================
BEGIN;

DO $$
DECLARE dupes integer;
BEGIN
  SELECT COUNT(*) INTO dupes FROM (
    SELECT 1 FROM public.reports WHERE format_id IS NOT NULL
    GROUP BY format_id, woreda_id, year, COALESCE(month, 0), COALESCE(quarter, 0)
    HAVING COUNT(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'Cannot add the unique report indexes: % (format, woreda, period) combination(s) already have more than one report. Find them with: SELECT format_id, woreda_id, year, month, quarter, COUNT(*), array_agg(id) FROM reports WHERE format_id IS NOT NULL GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1;', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_monthly
  ON public.reports (format_id, woreda_id, year, month)
  WHERE format_id IS NOT NULL AND month IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_quarterly
  ON public.reports (format_id, woreda_id, year, quarter)
  WHERE format_id IS NOT NULL AND month IS NULL AND quarter IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_annual
  ON public.reports (format_id, woreda_id, year)
  WHERE format_id IS NOT NULL AND month IS NULL AND quarter IS NULL;

COMMIT;
