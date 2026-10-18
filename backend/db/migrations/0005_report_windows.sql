-- ============================================================================
-- Migration: 0005_report_windows.sql
--
-- Reporting periods. For a MONTHLY report format, the Zonal Plan
-- Expert opens a month for the woredas of their zone with a time boundary:
-- woredas may create, edit and submit that month's report only between
-- opens_at and closes_at (enforced in the API, see reportController.js).
-- One row per (format, zone, year, month); `month` is the calendar month number
-- (July = 7 … June = 6), like plans.month. The zone can move the dates later
-- (e.g. extend the deadline). Same SHA-256 row_hash trigger as plans/reports.
-- ============================================================================
BEGIN;

CREATE TABLE public.report_windows (
    id serial PRIMARY KEY,
    format_id integer NOT NULL REFERENCES public.report_formats(id) ON DELETE RESTRICT,
    zone_id character varying(20) NOT NULL REFERENCES public.zones(zone_id) ON DELETE RESTRICT,
    year integer NOT NULL,
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    opens_at timestamp with time zone NOT NULL,
    closes_at timestamp with time zone NOT NULL,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    row_hash character varying(64),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT report_windows_dates_check CHECK (closes_at > opens_at),
    CONSTRAINT report_windows_format_zone_period_key UNIQUE (format_id, zone_id, year, month)
);

CREATE INDEX idx_report_windows_zone ON public.report_windows USING btree (zone_id, year, month);

CREATE TRIGGER trg_report_windows_row_hash
  BEFORE INSERT OR UPDATE ON public.report_windows
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_row_hash();

COMMIT;
