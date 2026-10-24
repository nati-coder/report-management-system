import { z } from 'zod';
import { ALL_ROLES } from '../constants/roles.js';
import { PERIOD_LIST } from '../constants/periodTypes.js';
import { normalizeNodes } from './formatTree.js';
import { ApiError } from './apiResponse.js';

/** Express middleware factory: validate req[source] with a zod schema */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors));
  }
  req[source] = result.data;
  next();
};

const id = z.coerce.number().int().positive();

/** 8+ chars, at least one uppercase, one lowercase, and one special (non-alphanumeric) character. */
const strongPassword = z.string()
  .min(8, 'Must be at least 8 characters')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[^A-Za-z0-9]/, 'Must include a special character');

// One KPI field inside a template section. `key` is the slug used both as
// the DynamicReportForm input id and, later, the data key a submitted
// report stores its value under — must be unique across the whole template
// (enforced in schemas.template below, since that needs to see every
// section at once).
const kpiFieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Key must be lowercase letters, numbers and underscores only')
    .refine((k) => !['id', 'created_at', 'updated_at', 'status'].includes(k), 'That key is reserved'),
  label: z.string().min(1),
  type: z.enum(['number', 'percentage', 'currency', 'date', 'boolean', 'text']),
  unit: z.string().max(100).nullish(),
  target: z.number().nullish(),
  required: z.boolean().default(false),
  min: z.number().nullish(),
  max: z.number().nullish(),
}).refine((f) => f.min == null || f.max == null || f.min <= f.max, {
  message: 'min must not be greater than max', path: ['min'],
});

const templateSchemaDefinition = z.object({
  sections: z.array(z.object({
    title: z.string().min(1),
    fields: z.array(kpiFieldSchema).min(1, 'Each section needs at least one KPI'),
  })).min(1, 'At least one section is required'),
}).superRefine((schema, ctx) => {
  const keys = schema.sections.flatMap((s) => s.fields.map((f) => f.key));
  const dupes = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
  if (dupes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate KPI key(s): ${dupes.join(', ')}` });
  }
});

// A report format is a numbered outline (1. / 1.1. / 1.1.1. …, unlimited depth) of items that each
// have only a title and a measurement. Validation + numbering live in utils/formatTree.js.
const formatTreeDefinition = z.object({ nodes: z.array(z.any()).min(1, 'Add at least one item') })
  .transform((def, ctx) => {
    const r = normalizeNodes(def.nodes);
    if (r.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error });
      return z.NEVER;
    }
    return { nodes: r.nodes };
  });

export const schemas = {
  login: z.object({ email: z.string().email(), password: z.string().min(1) }),
  createZone: z.object({
    zone_id: z.string().min(1).max(20),
    name: z.string().min(2),
    name_amharic: z.string().max(255).nullish(),
  }),
  createWoreda: z.object({
    woreda_id: z.string().min(1).max(20),
    zone_id: z.string().min(1).max(20),
    name: z.string().min(2),
    name_amharic: z.string().max(255).nullish(),
  }),
  updateZone: z.object({
    name: z.string().min(2).optional(),
    name_amharic: z.string().max(255).nullish(),
  }),
  updateWoreda: z.object({
    name: z.string().min(2).optional(),
    name_amharic: z.string().max(255).nullish(),
    zone_id: z.string().min(1).max(20).optional(),
  }),
  createDepartment: z.object({
    name: z.string().min(2),
    amharic_name: z.string().min(1).max(255),
  }),
  createTeam: z.object({
    name: z.string().min(2),
    department_id: id,
  }),
  updateDepartment: z.object({
    name: z.string().min(2).optional(),
    amharic_name: z.string().min(1).max(255).optional(),
  }),
  updateTeam: z.object({
    name: z.string().min(2).optional(),
    department_id: id.optional(),
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: strongPassword,
  }),
  adminSetPassword: z.object({
    newPassword: strongPassword,
  }),
  createUser: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: strongPassword,
    role: z.enum(ALL_ROLES),
    zone_id: z.string().max(20).nullish(),
    woreda_id: z.string().max(20).nullish(),
    department_id: id.nullish(),
    team_id: id.nullish(),
  }),
  updateUser: z.object({
    name: z.string().min(2).optional(),
    role: z.enum(ALL_ROLES).optional(),
    zone_id: z.string().max(20).nullish(),
    woreda_id: z.string().max(20).nullish(),
    department_id: id.nullish(),
    team_id: id.nullish(),
    is_active: z.boolean().optional(),
  }),
  // Only version_id, team_id and title are required. type / start_year / version / json_schema are filled in
  // with defaults (monthly, the report version's year, '1.0', no sections yet) when they are left out.
  template: z.object({
    title: z.string().trim().min(2),
    type: z.enum(PERIOD_LIST).optional(),
    start_year: z.number().int().optional(),
    end_year: z.number().int().nullish(),
    version: z.string().min(1).optional(),
    version_id: id, // required: report_templates.version_id -> report_versions(id)
    department_id: id.nullish(),
    team_id: id, // required: report_templates.team_id -> teams(id)
    json_schema: templateSchemaDefinition.optional(),
  }),
  // "Create for all teams": only the report version and the title are required.
  templatesForVersion: z.object({
    version_id: id,
    title: z.string().trim().min(2),
    type: z.enum(PERIOD_LIST).optional(),
    start_year: z.number().int().optional(),
    end_year: z.number().int().nullish(),
    templateVersion: z.string().min(1).optional(),
  }),
  reportFormat: z.object({
    template_id: id,
    schema_definition: formatTreeDefinition,
  }),
  reportFormatUpdate: z.object({ schema_definition: formatTreeDefinition }),
  reportFormatReview: z.object({
    action: z.enum(['approve', 'reject']),
    rejection_reason: z.string().max(2000).optional(),
  }),
  // Step 1 of the annual plan: the zone's targets
  zonePlanSave: z.object({
    format_id: id,
    year: z.number().int(),
    zone_id: z.string().max(20).optional(), // admin only; zonal users plan their own zone
    data: z.record(z.any()),
  }),
  // Step 2: plan woredas against the zone plan
  plansCascade: z.object({
    format_id: id,
    year: z.number().int(),
    submit: z.boolean().default(false), // false = save as draft, true = cascade to the woredas
    allocations: z.array(z.object({
      woreda_id: z.string().min(1).max(20),
      data: z.record(z.any()),
    })).min(1, 'Choose at least one woreda'),
  }),
  // Monthly plan of one woreda: its annual targets divided across the months
  monthlyPlanSave: z.object({
    format_id: id,
    year: z.number().int(),
    woreda_id: z.string().min(1).max(20),
    submit: z.boolean().default(false), // false = save as draft, true = cascade to the woreda
    months: z.array(z.object({
      month: z.number().int().min(1).max(12),
      data: z.record(z.any()),
    })).min(1).max(12),
  }),
  // A reporting period: a month of a monthly report format opened for a zone's woredas between two times
  reportWindow: z.object({
    format_id: id.optional(),
    year: z.number().int(),
    month: z.number().int().min(1).max(12), // calendar month number (July = 7 … June = 6)
    opens_at: z.string().min(1),
    closes_at: z.string().min(1),
    zone_id: z.string().min(1).max(20).optional(), // admin only; zonal users open their own zone
  }),
  reportWindowUpdate: z.object({ opens_at: z.string().min(1).optional(), closes_at: z.string().min(1).optional() })
    .refine((v) => v.opens_at || v.closes_at, 'Give a new opening time or deadline'),
  // A plan table as shown on screen, to be downloaded as an Excel file
  planTableExport: z.object({
    title: z.string().min(1).max(200),
    lines: z.array(z.string().max(300)).max(10).default([]),
    sheet: z.string().max(60).optional(),
    indentColumn: z.number().int().min(0).max(10).optional(),
    columns: z.array(z.string().max(120)).min(1).max(150),
    rows: z.array(z.object({
      cells: z.array(z.union([z.string().max(500), z.number(), z.null()])).max(150),
      depth: z.number().int().min(0).max(15).default(0),
      bold: z.boolean().default(false),
    })).max(5000),
  }),
  // The woreda's answer to a cascaded plan
  planReview: z.object({
    action: z.enum(['approve', 'reject']),
    rejection_reason: z.string().max(2000).optional(),
  }),
  reportVersion: z.object({
    name: z.string().min(2),
    year: z.number().int(),
    dep_id: id,
    max_nesting_level: z.number().int().min(1).max(10).optional(),
    nodes: z.array(z.object({
      node_code: z.string().min(1),
      parent_code: z.string().nullish(),
      team_id: id,
      label: z.string().min(1),
      level: z.number().int().min(1).optional(),
      display_order: z.number().int(),
      data_type: z.enum(['number', 'text', 'percentage', 'currency', 'date', 'boolean', 'calculated']).nullish(),
      measurement_unit: z.string().nullish(),
    })).default([]),
  }),
  report: z.object({
    format_id: id, // an APPROVED report_formats row
    title: z.string().min(2),
    type: z.enum(PERIOD_LIST),
    year: z.number().int(),
    quarter: z.number().int().min(1).max(4).nullish(),
    month: z.number().int().min(1).max(12).nullish(),
    woreda_id: z.string().max(20).optional(),
    team_id: id.nullish(),
    data: z.record(z.any()).default({}),
  }),
  reportUpdate: z.object({ title: z.string().min(2).optional(), data: z.record(z.any()) }),
  review: z.object({
    action: z.enum(['start_review', 'approve', 'reject']),
    feedback: z.string().max(2000).optional(),
  }),
  woredaReview: z.object({
    action: z.enum(['approve', 'reject']),
    feedback: z.string().max(2000).optional(),
  }),
  teamScore: z.object({
    report_id: id,
    score: z.number().min(0),
    max_score: z.number().positive().default(100),
    feedback: z.string().max(2000).optional(),
  }),
  computeRanking: z.object({
    woreda_id: z.string().max(20),
    period_type: z.enum(PERIOD_LIST),
    year: z.number().int(),
    month: z.number().int().min(1).max(12).nullish(),
    quarter: z.number().int().min(1).max(4).nullish(),
  }),
  woredaRank: z.object({
    woreda_id: z.string().max(20),
    year: z.number().int(),
    period_type: z.enum(PERIOD_LIST),
    total_score: z.number().min(0).optional(),
    overall_rank: id,
    manual_feedback: z.string().max(2000).optional(),
  }),
  supportRequest: z.object({
    title: z.string().min(3),
    description: z.string().min(3),
    category: z.string().max(100).optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
  assignSupport: z.object({ assigned_expert_id: id }),
  supportStatus: z.object({ status: z.enum(['pending', 'assigned', 'in_progress', 'resolved', 'closed']) }),
  expertFeedback: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }),
};
