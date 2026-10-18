-- ============================================================================
-- Migration: 0001_report_format_hash_restructure.sql
--
-- Restructures the reporting hierarchy to:
--   report_versions (1)──<(N) report_templates (1)──<(N) report_formats
--     report_formats (1)──<(N) plans
--     report_formats (1)──<(N) reports
--
-- and adds SHA-256 row_hash integrity columns + an auto-hashing trigger
-- to report_formats, plans and reports.
--
-- READ BEFORE RUNNING ON A DATABASE WITH REAL DATA
-- --------------------------------------------------
-- * report_version is renamed to report_versions. All existing rows and
--   their relationships are preserved (Postgres tracks FKs by OID, not
--   name, so nothing else needs to change for this rename to keep working).
--
-- * The OLD report_formats table — the per-field node tree used by the
--   Excel-import / annual-plan pipeline (parent_node_id, node_code,
--   level, etc.) — is renamed to report_format_nodes so none of that
--   data is lost or altered. annual_plans / plan_values /
--   plan_monthly_values are left completely untouched and keep working
--   against report_format_nodes exactly as before.
--
-- * A brand-new report_formats table is created matching the design
--   requested here: one row per format revision, a JSONB
--   schema_definition, and a DRAFT -> PENDING_APPROVAL -> APPROVED /
--   REJECTED workflow. This is a genuinely different data model from
--   the old node tree (one blob per format vs. one row per field), so
--   it could not be produced by altering the old table in place.
--
-- * annual_plans/plan_values/plan_monthly_values are NOT migrated into
--   the new `plans` table automatically. There is no reliable automatic
--   way to collapse a tree of individual field values into a single
--   JSONB blob per period — that mapping is a product decision, not a
--   mechanical one. Both structures exist side by side after this
--   migration; migrating old data into `plans` is a separate, deliberate
--   follow-up if you want it.
--
-- * reports.template_id is replaced by reports.format_id. There is no
--   automatic mapping from an old template_id to a specific new
--   report_formats row (a template may now have several format
--   revisions), so format_id is added NULLABLE. Existing report rows
--   will have format_id = NULL until you backfill them. Once backfilled,
--   run the commented ALTER at the bottom of this file to enforce
--   NOT NULL.
--
-- * The application layer (controllers, routes, and the frontend's
--   report/template pages and Excel-import flow) still reads/writes
--   the OLD shape (reports.template_id, the report_formats node tree).
--   This migration and the accompanying model updates bring the
--   database and data-access layer in line with the new design; the
--   controllers/routes/UI that call them need a follow-up pass before
--   end-to-end report submission works against the new tables again.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. report_version -> report_versions (rename only, data preserved)
-- ----------------------------------------------------------------------------
ALTER TABLE public.report_version RENAME TO report_versions;
ALTER SEQUENCE public.report_version_id_seq RENAME TO report_versions_id_seq;
ALTER TABLE public.report_versions RENAME CONSTRAINT report_version_pkey TO report_versions_pkey;
ALTER TABLE public.report_versions RENAME CONSTRAINT report_version_dep_id_year_name_key TO report_versions_dep_id_year_name_key;

-- ----------------------------------------------------------------------------
-- 2. report_templates: require version_id (FK -> report_versions) and
--    require team_id (was optional before).
-- ----------------------------------------------------------------------------
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS version_id integer;

-- Backfill: any existing templates with no version get attached to a
-- placeholder "Legacy / Unassigned" version so version_id can become
-- NOT NULL without losing rows. Only runs if there's something to backfill
-- and at least one department + one user exist to own the placeholder.
DO $$
DECLARE
  legacy_version_id integer;
  any_dept_id integer;
  any_user_id integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.report_templates WHERE version_id IS NULL) THEN
    SELECT id INTO any_dept_id FROM public.departments ORDER BY id LIMIT 1;
    SELECT id INTO any_user_id FROM public.users ORDER BY id LIMIT 1;

    IF any_dept_id IS NOT NULL AND any_user_id IS NOT NULL THEN
      INSERT INTO public.report_versions (name, year, dep_id, created_by)
      VALUES ('Legacy / Unassigned', EXTRACT(YEAR FROM now())::int, any_dept_id, any_user_id)
      RETURNING id INTO legacy_version_id;

      UPDATE public.report_templates SET version_id = legacy_version_id WHERE version_id IS NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.report_templates ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE public.report_templates
  ADD CONSTRAINT report_templates_version_id_fkey
  FOREIGN KEY (version_id) REFERENCES public.report_versions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_report_templates_version ON public.report_templates USING btree (version_id);

-- team_id becomes required. Best-effort backfill to the first existing
-- team for any template that doesn't have one; if no team exists at all,
-- the subsequent SET NOT NULL will fail with a clear error.
UPDATE public.report_templates t
SET team_id = (SELECT id FROM public.teams ORDER BY id LIMIT 1)
WHERE t.team_id IS NULL;

ALTER TABLE public.report_templates DROP CONSTRAINT IF EXISTS report_templates_team_id_fkey;
ALTER TABLE public.report_templates ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE public.report_templates
  ADD CONSTRAINT report_templates_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_report_templates_team ON public.report_templates USING btree (team_id);

-- ----------------------------------------------------------------------------
-- 3. Preserve the OLD report_formats (per-field node tree) under a new name.
--    Nothing about its structure or data changes — only the name, so the
--    existing plan_values/plan_monthly_values FKs keep working untouched
--    (Postgres resolves FKs by OID, not by name).
-- ----------------------------------------------------------------------------
ALTER TABLE public.report_formats RENAME TO report_format_nodes;
ALTER SEQUENCE public.report_formats_id_seq RENAME TO report_format_nodes_id_seq;
ALTER TABLE public.report_format_nodes RENAME CONSTRAINT report_formats_pkey TO report_format_nodes_pkey;
ALTER TABLE public.report_format_nodes
  RENAME CONSTRAINT report_formats_report_version_id_parent_node_id_node_code_t_key
  TO report_format_nodes_version_parent_code_team_key;

-- ----------------------------------------------------------------------------
-- 4. NEW report_formats: one row per format revision, JSONB schema,
--    DRAFT -> PENDING_APPROVAL -> APPROVED / REJECTED workflow.
-- ----------------------------------------------------------------------------
CREATE TABLE public.report_formats (
    id integer NOT NULL,
    template_id integer NOT NULL,
    version integer NOT NULL DEFAULT 1,
    schema_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    status character varying(20) NOT NULL DEFAULT 'draft',
    created_by integer,
    submitted_at timestamp without time zone,
    approved_by integer,
    approved_at timestamp without time zone,
    rejection_reason text,
    row_hash character varying(64),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT report_formats_status_check
      CHECK (((status)::text = ANY ((ARRAY['draft', 'pending_approval', 'approved', 'rejected'])::text[])))
);

CREATE SEQUENCE public.report_formats_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.report_formats_id_seq OWNED BY public.report_formats.id;
ALTER TABLE ONLY public.report_formats ALTER COLUMN id SET DEFAULT nextval('public.report_formats_id_seq'::regclass);

ALTER TABLE ONLY public.report_formats ADD CONSTRAINT report_formats_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.report_formats
  ADD CONSTRAINT report_formats_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_formats
  ADD CONSTRAINT report_formats_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.report_formats
  ADD CONSTRAINT report_formats_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX idx_report_formats_template ON public.report_formats USING btree (template_id);
CREATE INDEX idx_report_formats_status ON public.report_formats USING btree (status);

-- ----------------------------------------------------------------------------
-- 5. NEW plans table: baseline/target values for a team + woreda + period
--    against one approved report_formats row. Replaces the role of
--    annual_plans + plan_values + plan_monthly_values for formats created
--    under the new system (the old tables are untouched for existing data).
-- ----------------------------------------------------------------------------
CREATE TABLE public.plans (
    id integer NOT NULL,
    format_id integer NOT NULL,
    team_id integer NOT NULL,
    woreda_id character varying(20) NOT NULL,
    year integer NOT NULL,
    month integer,
    quarter integer,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    status character varying(20) NOT NULL DEFAULT 'draft',
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    row_hash character varying(64),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT plans_status_check
      CHECK (((status)::text = ANY ((ARRAY['draft', 'submitted', 'approved', 'rejected'])::text[]))),
    CONSTRAINT plans_month_check CHECK ((month IS NULL) OR (month BETWEEN 1 AND 12)),
    CONSTRAINT plans_quarter_check CHECK ((quarter IS NULL) OR (quarter BETWEEN 1 AND 4))
);

CREATE SEQUENCE public.plans_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;
ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);

ALTER TABLE ONLY public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.plans
  ADD CONSTRAINT plans_format_id_fkey FOREIGN KEY (format_id) REFERENCES public.report_formats(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.plans
  ADD CONSTRAINT plans_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.plans
  ADD CONSTRAINT plans_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.plans
  ADD CONSTRAINT plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.plans
  ADD CONSTRAINT plans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- One plan per format/team/woreda/period (COALESCE so NULL month/quarter
-- still participate in uniqueness instead of always comparing unequal).
CREATE UNIQUE INDEX plans_unique_period
  ON public.plans (format_id, team_id, woreda_id, year, COALESCE(month, 0), COALESCE(quarter, 0));
CREATE INDEX idx_plans_format ON public.plans USING btree (format_id);
CREATE INDEX idx_plans_team ON public.plans USING btree (team_id);
CREATE INDEX idx_plans_woreda ON public.plans USING btree (woreda_id);

-- ----------------------------------------------------------------------------
-- 6. reports: replace template_id with format_id.
-- ----------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS format_id integer;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_format_id_fkey FOREIGN KEY (format_id) REFERENCES public.report_formats(id) ON DELETE RESTRICT;
CREATE INDEX idx_reports_format ON public.reports USING btree (format_id);

DROP INDEX IF EXISTS idx_reports_template;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_template_id_fkey;
ALTER TABLE public.reports DROP COLUMN IF EXISTS template_id;

-- ----------------------------------------------------------------------------
-- 7. SHA-256 row_hash columns on the three "critical" tables.
--    (report_formats and plans already have it from their CREATE TABLE
--    above; these two ADD COLUMN IF NOT EXISTS calls make the migration
--    safe to read/copy as a single reference for "which tables got a hash".)
-- ----------------------------------------------------------------------------
ALTER TABLE public.report_formats ADD COLUMN IF NOT EXISTS row_hash character varying(64);
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS row_hash character varying(64);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS row_hash character varying(64);

-- ----------------------------------------------------------------------------
-- 8. Trigger function: computes a SHA-256 hash of each row's business
--    columns (excluding the hash column itself and audit timestamps,
--    which would otherwise make the hash change on every touch) on every
--    insert/update. Generic — works on any table that has a row_hash
--    column, since to_jsonb(NEW) adapts to whatever table fired it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_row_hash() RETURNS trigger AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := to_jsonb(NEW) - 'row_hash' - 'created_at' - 'updated_at';
  NEW.row_hash := encode(digest(payload::text, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_formats_row_hash ON public.report_formats;
CREATE TRIGGER trg_report_formats_row_hash
  BEFORE INSERT OR UPDATE ON public.report_formats
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_row_hash();

DROP TRIGGER IF EXISTS trg_plans_row_hash ON public.plans;
CREATE TRIGGER trg_plans_row_hash
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_row_hash();

DROP TRIGGER IF EXISTS trg_reports_row_hash ON public.reports;
CREATE TRIGGER trg_reports_row_hash
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_row_hash();

COMMIT;

-- ----------------------------------------------------------------------------
-- OPTIONAL FOLLOW-UP — run manually once every reports row has a format_id:
--   ALTER TABLE public.reports ALTER COLUMN format_id SET NOT NULL;
-- ----------------------------------------------------------------------------
