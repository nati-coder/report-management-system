-- ============================================================================
-- Migration: 0003_zone_plans.sql
--
-- The ZONE plan: the zone's annual target for each measured item of an approved
-- report format. It is entered first; each woreda's plan (table `plans`) is then
-- planned against it (woreda totals must add up to it, and parents must equal the
-- sum of their sub-items — enforced in the API, see utils/planChecks.js).
-- One row per (format, zone, year). Same SHA-256 row_hash trigger as plans/reports.
-- ============================================================================
BEGIN;

CREATE TABLE public.zone_plans (
    id serial PRIMARY KEY,
    format_id integer NOT NULL REFERENCES public.report_formats(id) ON DELETE RESTRICT,
    zone_id character varying(20) NOT NULL REFERENCES public.zones(zone_id) ON DELETE RESTRICT,
    team_id integer NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
    year integer NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    row_hash character varying(64),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT zone_plans_format_zone_year_key UNIQUE (format_id, zone_id, year)
);

CREATE INDEX idx_zone_plans_zone ON public.zone_plans USING btree (zone_id);

CREATE TRIGGER trg_zone_plans_row_hash
  BEFORE INSERT OR UPDATE ON public.zone_plans
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_row_hash();

COMMIT;
