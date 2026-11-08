-- ============================================================================
-- Migration: 0010_review_feedback.sql
--
-- Reviewers give written FEEDBACK (no score):
--   woreda_report      Zonal Expert / Team Leader, on one woreda's report of their team (report_id)
--   woreda_plan        Zonal Expert / Team Leader, on one woreda's plan of their team (format_id, woreda_id, year)
--   zone_plan          Zonal Expert / Team Leader, on the zone's plan of their team (format_id, zone_id, year)
--   department_report  Zonal Dept Head, on the achievement of the whole department's reports for a period
--                      (department_id, zone_id, year, period = m7 | q1 | h1 | annual …)
-- Feedback is a log: several entries may exist for the same subject; the newest is shown first.
-- team_feedback (the old score table) is left in place for history; nothing writes to it any more.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.review_feedback (
    id serial PRIMARY KEY,
    kind varchar(30) NOT NULL,
    format_id integer REFERENCES public.report_formats(id) ON DELETE CASCADE,
    report_id integer REFERENCES public.reports(id) ON DELETE CASCADE,
    department_id integer REFERENCES public.departments(id) ON DELETE CASCADE,
    team_id integer REFERENCES public.teams(id) ON DELETE SET NULL,
    zone_id varchar(20),
    woreda_id varchar(20),
    year integer,
    period varchar(12),
    body text NOT NULL,
    author_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    author_role varchar(40),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_feedback_kind_check CHECK (kind IN ('woreda_report', 'woreda_plan', 'zone_plan', 'department_report')),
    CONSTRAINT review_feedback_body_check CHECK (length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_review_feedback_report ON public.review_feedback (report_id) WHERE report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_feedback_plan ON public.review_feedback (kind, format_id, year, woreda_id);
CREATE INDEX IF NOT EXISTS idx_review_feedback_dept ON public.review_feedback (kind, department_id, zone_id, year, period);

COMMIT;
