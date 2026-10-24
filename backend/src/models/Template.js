import { query, withTransaction } from '../../config/db.js';

const Template = {
  async list({ type, department_id, team_id, version_id, active } = {}) {
    const cond = []; const p = [];
    if (type) { p.push(type); cond.push(`type = $${p.length}`); }
    if (department_id) { p.push(department_id); cond.push(`department_id = $${p.length}`); }
    if (team_id) { p.push(team_id); cond.push(`team_id = $${p.length}`); }
    if (version_id) { p.push(version_id); cond.push(`version_id = $${p.length}`); }
    if (active !== undefined) { p.push(active); cond.push(`active_flag = $${p.length}`); }
    const { rows } = await query(
      `SELECT * FROM report_templates ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY created_at DESC`, p);
    return rows;
  },
  async findById(id) {
    const { rows } = await query('SELECT * FROM report_templates WHERE id = $1', [id]);
    return rows[0] || null;
  },
  /** version_id and team_id are required (report_templates.version_id -> report_versions, .team_id -> teams). */
  async create(t, userId) {
    const { rows } = await query(
      `INSERT INTO report_templates (title, type, start_year, end_year, version, version_id, created_by, department_id, team_id, json_schema)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [t.title, t.type, t.start_year, t.end_year ?? null, t.version, t.version_id, userId, t.department_id ?? null, t.team_id, JSON.stringify(t.json_schema)]
    );
    return rows[0];
  },
  async update(id, t) {
    const { rows } = await query(
      `UPDATE report_templates SET title=$1, type=$2, start_year=$3, end_year=$4, version=$5,
         version_id=$6, department_id=$7, team_id=$8, json_schema=$9, revised_at=CURRENT_TIMESTAMP
       WHERE id=$10 RETURNING *`,
      [t.title, t.type, t.start_year, t.end_year ?? null, t.version, t.version_id, t.department_id ?? null, t.team_id, JSON.stringify(t.json_schema), id]
    );
    return rows[0] || null;
  },
  /**
   * True if any report has ever been submitted against a report_formats
   * row under this template. reports link to report_formats (format_id),
   * and report_formats links to report_templates (template_id) — so this
   * is a two-hop check, not a direct template_id on reports.
   */
  async hasSubmittedReports(templateId) {
    const { rows } = await query(
      `SELECT 1 FROM report_formats rf JOIN reports r ON r.format_id = rf.id
       WHERE rf.template_id = $1 LIMIT 1`,
      [templateId]);
    return rows.length > 0;
  },

  async setActive(id, active, reviewerId) {
    const { rows } = await query(
      'UPDATE report_templates SET active_flag=$1, reviewed_by=$2, revised_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *',
      [active, reviewerId, id]);
    return rows[0] || null;
  },

  // ---- report_versions (renamed from report_version by migration 0001;
  // same table, same data, same behavior as before) + the LEGACY
  // report_format_nodes per-field tree (renamed from the old
  // report_formats). Both are kept exactly as they worked previously so
  // the existing Excel-import pipeline (excelParserService/
  // importController) keeps functioning against versions created before
  // the report_formats/plans redesign. New work should create formats via
  // the ReportFormat model and plan data via the Plan model instead. ----
  /** openOnly: leave out the versions the System Admin has closed (what template creation offers). */
  async listVersions(depId, { openOnly = false } = {}) {
    const cond = []; const p = [];
    if (depId) { p.push(depId); cond.push(`dep_id = $${p.length}`); }
    if (openOnly) cond.push('closed_at IS NULL');
    const { rows } = await query(
      `SELECT * FROM report_versions ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY year DESC, id DESC`, p);
    return rows;
  },
  async findVersionById(id) {
    const { rows } = await query('SELECT * FROM report_versions WHERE id=$1', [id]);
    return rows[0] || null;
  },
  async getVersionTree(versionId, teamId) {
    const version = await this.findVersionById(versionId);
    if (!version) return null;
    const p = [versionId];
    let sql = 'SELECT * FROM report_format_nodes WHERE report_version_id=$1';
    if (teamId) { p.push(teamId); sql += ' AND team_id=$2'; }
    const { rows: nodes } = await query(sql + ' ORDER BY level, display_order', p);
    const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
    const roots = [];
    for (const n of byId.values()) {
      if (n.parent_node_id && byId.has(n.parent_node_id)) byId.get(n.parent_node_id).children.push(n);
      else roots.push(n);
    }
    return { ...version, nodes: roots };
  },
  /** Creates a report_versions row and inserts legacy report_format_nodes, resolving parent_code -> parent id (per team). */
  async createVersion(v, userId) {
    return withTransaction(async (c) => {
      const { rows: [version] } = await c.query(
        `INSERT INTO report_versions (name, year, dep_id, created_by, max_nesting_level)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [v.name, v.year, v.dep_id, userId, v.max_nesting_level ?? 5]);
      const idByKey = new Map(); // `${team}:${code}` -> id
      const pending = [...v.nodes];
      let guard = pending.length + 1;
      while (pending.length && guard-- > 0) {
        for (let i = pending.length - 1; i >= 0; i--) {
          const n = pending[i];
          const parentKey = n.parent_code ? `${n.team_id}:${n.parent_code}` : null;
          if (parentKey && !idByKey.has(parentKey)) continue; // parent not inserted yet
          const level = n.level ?? (parentKey ? 2 : 1);
          const { rows: [row] } = await c.query(
            `INSERT INTO report_format_nodes
              (report_version_id, parent_node_id, team_id, node_code, label, level, display_order, data_type, measurement_unit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [version.id, parentKey ? idByKey.get(parentKey) : null, n.team_id, n.node_code, n.label, level, n.display_order, n.data_type ?? null, n.measurement_unit ?? null]);
          idByKey.set(`${n.team_id}:${n.node_code}`, row.id);
          pending.splice(i, 1);
        }
      }
      if (pending.length) throw Object.assign(new Error('Some nodes reference unknown parent_code'), { status: 400 });
      // mark parents
      await c.query(
        `UPDATE report_format_nodes SET has_children = true
         WHERE report_version_id=$1 AND id IN (SELECT parent_node_id FROM report_format_nodes WHERE report_version_id=$1 AND parent_node_id IS NOT NULL)`,
        [version.id]);
      return version;
    });
  },
  /** System Admin: close a version for good. Returns null if it doesn't exist or is already closed. */
  async closeVersion(id, userId) {
    const { rows } = await query(
      'UPDATE report_versions SET closed_at=CURRENT_TIMESTAMP, closed_by=$1 WHERE id=$2 AND closed_at IS NULL RETURNING *', [userId, id]);
    return rows[0] || null;
  },
  async approveVersion(id, userId) {
    const { rows } = await query(
      'UPDATE report_versions SET approved_by=$1, approval_date=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [userId, id]);
    return rows[0] || null;
  },

  /**
   * Created by ZONAL_PLAN_EXPERT: one report_templates row per team in the
   * version's department, all linked to the same report_versions row.
   * Idempotent — a team that already has a template under this version is
   * skipped rather than duplicated (report_templates has no DB-level
   * unique constraint on (version_id, team_id), so this check matters).
   */
  async createForAllTeams({ version_id, dep_id, title, type, start_year, end_year, templateVersion }, userId) {
    // Only the version and the title are required; everything else has a default.
    type = type ?? 'monthly';
    templateVersion = templateVersion ?? '1.0';
    return withTransaction(async (c) => {
      const { rows: teams } = await c.query(
        'SELECT id, name FROM teams WHERE department_id = $1 ORDER BY name', [dep_id]);
      const { rows: existing } = await c.query(
        'SELECT team_id FROM report_templates WHERE version_id = $1', [version_id]);
      const already = new Set(existing.map((r) => r.team_id));

      const createdRows = [];
      for (const team of teams) {
        if (already.has(team.id)) continue;
        const { rows: [row] } = await c.query(
          `INSERT INTO report_templates (title, type, start_year, end_year, version, version_id, created_by, department_id, team_id, json_schema)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [`${title} — ${team.name}`, type, start_year, end_year ?? null, templateVersion, version_id, userId, dep_id, team.id, '{}']);
        createdRows.push(row);
      }
      return { created: createdRows, skipped: teams.length - createdRows.length, totalTeams: teams.length };
    });
  },
};
export default Template;
