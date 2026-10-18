-- Woreda-Zonal Report Management System
-- PostgreSQL schema

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(255),
    target_type character varying(100),
    target_id integer,
    meta jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.annual_plans (
    id integer NOT NULL,
    woreda_id character varying(20) NOT NULL,
    team_id integer NOT NULL,
    report_version_id integer NOT NULL,
    zone_expert_id integer NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    submission_date timestamp without time zone,
    approval_date timestamp without time zone,
    approved_by integer,
    rejection_reason text,
    is_current boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_at timestamp without time zone,
    CONSTRAINT annual_plans_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'reviewing'::character varying, 'approved'::character varying, 'rejected'::character varying, 'archived'::character varying])::text[])))
);

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    amharic_name character varying(255) CONSTRAINT departments_level_not_null NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.expert_feedback (
    id integer NOT NULL,
    support_request_id integer,
    expert_id integer,
    given_by integer,
    rating integer,
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expert_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE public.import_logs (
    id integer NOT NULL,
    admin_id integer,
    woreda_id character varying(20),
    file_name character varying(512),
    file_path text,
    imported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(30) DEFAULT 'pending'::character varying,
    remarks text
);

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    message text,
    is_read boolean DEFAULT false,
    meta jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.plan_monthly_values (
    id integer NOT NULL,
    plan_value_id integer NOT NULL,
    node_id integer NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    text_value text,
    numeric_value numeric(30,6),
    percentage numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT plan_monthly_values_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT plan_monthly_values_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))
);

CREATE TABLE public.plan_values (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    node_id integer NOT NULL,
    text_value text,
    numeric_value numeric(30,6),
    date_value date,
    boolean_value boolean,
    calculated_value numeric(30,6),
    is_calculated boolean DEFAULT false,
    remarks text,
    data_source character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_value_type CHECK (((((((text_value IS NOT NULL))::integer + ((numeric_value IS NOT NULL))::integer) + ((date_value IS NOT NULL))::integer) + ((boolean_value IS NOT NULL))::integer) <= 1))
);

CREATE TABLE public.report_formats (
    id integer NOT NULL,
    report_version_id integer NOT NULL,
    parent_node_id integer,
    team_id integer NOT NULL,
    node_code character varying(100) NOT NULL,
    label character varying(500) NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    display_order integer NOT NULL,
    data_type character varying(50),
    measurement_unit character varying(100),
    has_children boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT report_formats_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['number'::character varying, 'text'::character varying, 'percentage'::character varying, 'currency'::character varying, 'date'::character varying, 'boolean'::character varying, 'calculated'::character varying])::text[])))
);

CREATE TABLE public.report_templates (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    type character varying(20) NOT NULL,
    start_year integer NOT NULL,
    end_year integer,
    version character varying(20) NOT NULL,
    created_by integer,
    reviewed_by integer,
    department_id integer,
    team_id integer,
    active_flag boolean DEFAULT true,
    json_schema jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    revised_at timestamp without time zone,
    CONSTRAINT report_templates_type_check CHECK (((type)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'annual'::character varying])::text[])))
);

CREATE TABLE public.report_version (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    year integer NOT NULL,
    dep_id integer NOT NULL,
    created_by integer NOT NULL,
    approved_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_date timestamp without time zone,
    is_active boolean DEFAULT true,
    max_nesting_level integer DEFAULT 5
);

CREATE TABLE public.reports (
    id integer NOT NULL,
    template_id integer,
    title character varying(255),
    type character varying(20),
    year integer,
    quarter integer,
    month integer,
    woreda_id character varying(20),
    team_id integer,
    created_by integer,
    file_path text,
    data jsonb,
    status character varying(30) DEFAULT 'draft'::character varying,
    source character varying(20) DEFAULT 'online'::character varying,
    submitted_at timestamp without time zone,
    reviewed_by integer,
    feedback text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    CONSTRAINT reports_type_check CHECK (((type)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'annual'::character varying])::text[])))
);

CREATE TABLE public.support_requests (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(30) DEFAULT 'pending'::character varying,
    woreda_department_head_id integer,
    zone_id character varying(20),
    zonal_department_head_id integer,
    assigned_expert_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    CONSTRAINT support_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])))
);

CREATE TABLE public.team_feedback (
    id integer NOT NULL,
    report_id integer,
    team_id integer,
    scored_by integer,
    score numeric,
    max_score numeric DEFAULT 100,
    feedback text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT team_feedback_score_check CHECK ((score >= (0)::numeric))
);

CREATE TABLE public.team_ranking (
    id integer NOT NULL,
    woreda_id character varying(20),
    period_type character varying(20),
    year integer,
    month integer,
    quarter integer,
    team_id integer,
    total_score numeric,
    rank integer,
    computed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT team_ranking_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'annual'::character varying])::text[])))
);

CREATE TABLE public.teams (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    department_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(512) NOT NULL,
    role character varying(50) NOT NULL,
    zone_id character varying(20),
    woreda_id character varying(20),
    department_id integer,
    team_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.woreda_ranking (
    id integer NOT NULL,
    woreda_id character varying(20),
    year integer NOT NULL,
    period_type character varying(20),
    total_score numeric,
    overall_rank integer,
    manual_feedback text,
    assigned_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT woreda_ranking_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'annual'::character varying])::text[])))
);

CREATE TABLE public.woredas (
    woreda_id character varying(20) NOT NULL,
    zone_id character varying(20),
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    name_amharic character varying(255)
);

CREATE TABLE public.zones (
    zone_id character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    name_amharic character varying(255)
);

CREATE SEQUENCE public.activity_logs_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.annual_plans_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.departments_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.expert_feedback_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.import_logs_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.notifications_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.plan_monthly_values_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.plan_values_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.report_formats_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.report_templates_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.report_version_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.reports_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.support_requests_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.team_feedback_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.team_ranking_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.teams_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.users_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE public.woreda_ranking_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;
ALTER SEQUENCE public.annual_plans_id_seq OWNED BY public.annual_plans.id;
ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;
ALTER SEQUENCE public.expert_feedback_id_seq OWNED BY public.expert_feedback.id;
ALTER SEQUENCE public.import_logs_id_seq OWNED BY public.import_logs.id;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
ALTER SEQUENCE public.plan_monthly_values_id_seq OWNED BY public.plan_monthly_values.id;
ALTER SEQUENCE public.plan_values_id_seq OWNED BY public.plan_values.id;
ALTER SEQUENCE public.report_formats_id_seq OWNED BY public.report_formats.id;
ALTER SEQUENCE public.report_templates_id_seq OWNED BY public.report_templates.id;
ALTER SEQUENCE public.report_version_id_seq OWNED BY public.report_version.id;
ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;
ALTER SEQUENCE public.support_requests_id_seq OWNED BY public.support_requests.id;
ALTER SEQUENCE public.team_feedback_id_seq OWNED BY public.team_feedback.id;
ALTER SEQUENCE public.team_ranking_id_seq OWNED BY public.team_ranking.id;
ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER SEQUENCE public.woreda_ranking_id_seq OWNED BY public.woreda_ranking.id;

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);
ALTER TABLE ONLY public.annual_plans ALTER COLUMN id SET DEFAULT nextval('public.annual_plans_id_seq'::regclass);
ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);
ALTER TABLE ONLY public.expert_feedback ALTER COLUMN id SET DEFAULT nextval('public.expert_feedback_id_seq'::regclass);
ALTER TABLE ONLY public.import_logs ALTER COLUMN id SET DEFAULT nextval('public.import_logs_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.plan_monthly_values ALTER COLUMN id SET DEFAULT nextval('public.plan_monthly_values_id_seq'::regclass);
ALTER TABLE ONLY public.plan_values ALTER COLUMN id SET DEFAULT nextval('public.plan_values_id_seq'::regclass);
ALTER TABLE ONLY public.report_formats ALTER COLUMN id SET DEFAULT nextval('public.report_formats_id_seq'::regclass);
ALTER TABLE ONLY public.report_templates ALTER COLUMN id SET DEFAULT nextval('public.report_templates_id_seq'::regclass);
ALTER TABLE ONLY public.report_version ALTER COLUMN id SET DEFAULT nextval('public.report_version_id_seq'::regclass);
ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);
ALTER TABLE ONLY public.support_requests ALTER COLUMN id SET DEFAULT nextval('public.support_requests_id_seq'::regclass);
ALTER TABLE ONLY public.team_feedback ALTER COLUMN id SET DEFAULT nextval('public.team_feedback_id_seq'::regclass);
ALTER TABLE ONLY public.team_ranking ALTER COLUMN id SET DEFAULT nextval('public.team_ranking_id_seq'::regclass);
ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.woreda_ranking ALTER COLUMN id SET DEFAULT nextval('public.woreda_ranking_id_seq'::regclass);

ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_woreda_id_team_id_report_version_id_key UNIQUE (woreda_id, team_id, report_version_id);
ALTER TABLE ONLY public.departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.expert_feedback ADD CONSTRAINT expert_feedback_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.import_logs ADD CONSTRAINT import_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.plan_monthly_values ADD CONSTRAINT plan_monthly_values_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.plan_monthly_values ADD CONSTRAINT plan_monthly_values_plan_value_id_node_id_month_year_key UNIQUE (plan_value_id, node_id, month, year);
ALTER TABLE ONLY public.plan_values ADD CONSTRAINT plan_values_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.plan_values ADD CONSTRAINT plan_values_plan_id_node_id_key UNIQUE (plan_id, node_id);
ALTER TABLE ONLY public.report_formats ADD CONSTRAINT report_formats_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.report_formats ADD CONSTRAINT report_formats_report_version_id_parent_node_id_node_code_t_key UNIQUE (report_version_id, parent_node_id, node_code, team_id);
ALTER TABLE ONLY public.report_templates ADD CONSTRAINT report_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.report_version ADD CONSTRAINT report_version_dep_id_year_name_key UNIQUE (dep_id, year, name);
ALTER TABLE ONLY public.report_version ADD CONSTRAINT report_version_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.reports ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.support_requests ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.team_feedback ADD CONSTRAINT team_feedback_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.team_ranking ADD CONSTRAINT team_ranking_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teams ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.woreda_ranking ADD CONSTRAINT woreda_ranking_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.woredas ADD CONSTRAINT woredas_pkey PRIMARY KEY (woreda_id);
ALTER TABLE ONLY public.zones ADD CONSTRAINT zones_pkey PRIMARY KEY (zone_id);

ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_report_version_id_fkey FOREIGN KEY (report_version_id) REFERENCES public.report_version(id);
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id);
ALTER TABLE ONLY public.annual_plans ADD CONSTRAINT annual_plans_zone_expert_id_fkey FOREIGN KEY (zone_expert_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.expert_feedback ADD CONSTRAINT expert_feedback_expert_id_fkey FOREIGN KEY (expert_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.expert_feedback ADD CONSTRAINT expert_feedback_given_by_fkey FOREIGN KEY (given_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.expert_feedback ADD CONSTRAINT expert_feedback_support_request_id_fkey FOREIGN KEY (support_request_id) REFERENCES public.support_requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.import_logs ADD CONSTRAINT import_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.import_logs ADD CONSTRAINT import_logs_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.plan_monthly_values ADD CONSTRAINT plan_monthly_values_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.report_formats(id);
ALTER TABLE ONLY public.plan_monthly_values ADD CONSTRAINT plan_monthly_values_plan_value_id_fkey FOREIGN KEY (plan_value_id) REFERENCES public.plan_values(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.plan_values ADD CONSTRAINT plan_values_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.report_formats(id);
ALTER TABLE ONLY public.plan_values ADD CONSTRAINT plan_values_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.annual_plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_formats ADD CONSTRAINT report_formats_parent_node_id_fkey FOREIGN KEY (parent_node_id) REFERENCES public.report_formats(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_formats ADD CONSTRAINT report_formats_report_version_id_fkey FOREIGN KEY (report_version_id) REFERENCES public.report_version(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_formats ADD CONSTRAINT report_formats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_templates ADD CONSTRAINT report_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.report_templates ADD CONSTRAINT report_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.report_templates ADD CONSTRAINT report_templates_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.report_templates ADD CONSTRAINT report_templates_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.report_version ADD CONSTRAINT report_version_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.report_version ADD CONSTRAINT report_version_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.report_version ADD CONSTRAINT report_version_dep_id_fkey FOREIGN KEY (dep_id) REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reports ADD CONSTRAINT reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reports ADD CONSTRAINT reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reports ADD CONSTRAINT reports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reports ADD CONSTRAINT reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reports ADD CONSTRAINT reports_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.support_requests ADD CONSTRAINT support_requests_assigned_expert_id_fkey FOREIGN KEY (assigned_expert_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.support_requests ADD CONSTRAINT support_requests_woreda_department_head_id_fkey FOREIGN KEY (woreda_department_head_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.support_requests ADD CONSTRAINT support_requests_zonal_department_head_id_fkey FOREIGN KEY (zonal_department_head_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.support_requests ADD CONSTRAINT support_requests_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(zone_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.team_feedback ADD CONSTRAINT team_feedback_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.team_feedback ADD CONSTRAINT team_feedback_scored_by_fkey FOREIGN KEY (scored_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.team_feedback ADD CONSTRAINT team_feedback_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.team_ranking ADD CONSTRAINT team_ranking_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.team_ranking ADD CONSTRAINT team_ranking_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(zone_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.woreda_ranking ADD CONSTRAINT woreda_ranking_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.woreda_ranking ADD CONSTRAINT woreda_ranking_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.woredas(woreda_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.woredas ADD CONSTRAINT woredas_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(zone_id) ON DELETE CASCADE;

CREATE INDEX idx_annual_plans_current ON public.annual_plans USING btree (is_current) WHERE (is_current = true);
CREATE INDEX idx_annual_plans_report_version ON public.annual_plans USING btree (report_version_id);
CREATE INDEX idx_annual_plans_status ON public.annual_plans USING btree (status);
CREATE INDEX idx_annual_plans_team ON public.annual_plans USING btree (team_id);
CREATE INDEX idx_annual_plans_woreda ON public.annual_plans USING btree (woreda_id);
CREATE INDEX idx_plan_monthly_values_month_year ON public.plan_monthly_values USING btree (month, year);
CREATE INDEX idx_plan_monthly_values_node ON public.plan_monthly_values USING btree (node_id);
CREATE INDEX idx_plan_monthly_values_plan_value ON public.plan_monthly_values USING btree (plan_value_id);
CREATE INDEX idx_plan_values_node ON public.plan_values USING btree (node_id);
CREATE INDEX idx_plan_values_numeric ON public.plan_values USING btree (numeric_value) WHERE (numeric_value IS NOT NULL);
CREATE INDEX idx_plan_values_plan ON public.plan_values USING btree (plan_id);
CREATE INDEX idx_report_formats_level ON public.report_formats USING btree (level);
CREATE INDEX idx_report_formats_node_code ON public.report_formats USING btree (node_code);
CREATE INDEX idx_report_formats_parent ON public.report_formats USING btree (parent_node_id);
CREATE INDEX idx_report_formats_report_version ON public.report_formats USING btree (report_version_id);
CREATE INDEX idx_report_formats_team ON public.report_formats USING btree (team_id);
CREATE INDEX idx_reports_template ON public.reports USING btree (template_id);
CREATE INDEX idx_reports_woreda ON public.reports USING btree (woreda_id);
CREATE INDEX idx_team_ranking_woreda ON public.team_ranking USING btree (woreda_id);
