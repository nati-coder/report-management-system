import fs from 'fs/promises';
import Template from '../models/Template.js';
import Report from '../models/Report.js';
import ImportLog from '../models/ImportLog.js';
import Zone from '../models/Zone.js';
import { withTransaction } from '../../config/db.js';
import catchAsync from '../utils/catchAsync.js';
import { success, ApiError } from '../utils/apiResponse.js';
import { parseWorkbook, coerceValue } from '../services/excelParserService.js';
import { canAccessWoreda } from '../middlewares/rbacMiddleware.js';

export const importExcel = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Excel file is required (field name: "file")');
  const woreda_id = req.body.woreda_id;
  const team_id = Number(req.body.team_id);
  const report_version_id = Number(req.body.report_version_id);
  const cleanup = () => fs.unlink(req.file.path).catch(() => {});

  if (!woreda_id || !team_id || !report_version_id) { await cleanup(); throw ApiError.badRequest('woreda_id, team_id and report_version_id are required'); }
  if (!(await Zone.findWoreda(woreda_id))) { await cleanup(); throw ApiError.badRequest('Unknown woreda_id'); }
  if (!(await canAccessWoreda(req.user, woreda_id))) { await cleanup(); throw ApiError.forbidden('Outside your administrative scope'); }

  const log = await ImportLog.create({ admin_id: req.user.id, woreda_id, file_name: req.file.originalname, file_path: req.file.path });
  try {
    const { plan, monthly } = parseWorkbook(req.file.path);
    const version = await Template.getVersionTree(report_version_id, team_id);
    if (!version) throw ApiError.badRequest('Report version not found');
    const flat = []; const walk = (ns) => ns.forEach((n) => { flat.push(n); walk(n.children); }); walk(version.nodes);
    const byCode = new Map(flat.map((n) => [String(n.node_code), n]));

    const errors = []; let planRows = 0; let monthlyRows = 0;
    await withTransaction(async (c) => {
      const annual = await Report.findOrCreatePlan(c, { woreda_id, team_id, report_version_id, zone_expert_id: req.user.id });
      const valueIdByNode = new Map();

      for (const [i, row] of plan.entries()) {
        const code = String(row.node_code ?? '').trim();
        const node = byCode.get(code);
        if (!node) { errors.push(`Plan row ${i + 2}: unknown node_code "${code}"`); continue; }
        try {
          const typed = coerceValue(row.value, node.data_type);
          const id = await Report.upsertPlanValue(c, annual.id, node.id, { ...typed, remarks: row.remarks });
          valueIdByNode.set(node.id, id); planRows++;
        } catch (e) { errors.push(`Plan row ${i + 2} (${code}): ${e.message}`); }
      }

      for (const [i, row] of monthly.entries()) {
        const code = String(row.node_code ?? '').trim();
        const node = byCode.get(code);
        const month = Number(row.month); const year = Number(row.year) || version.year;
        if (!node) { errors.push(`Monthly row ${i + 2}: unknown node_code "${code}"`); continue; }
        if (!(month >= 1 && month <= 12)) { errors.push(`Monthly row ${i + 2}: invalid month`); continue; }
        try {
          let pvId = valueIdByNode.get(node.id);
          if (!pvId) pvId = await Report.upsertPlanValue(c, annual.id, node.id, { data_source: 'excel_import' });
          valueIdByNode.set(node.id, pvId);
          const typed = coerceValue(row.value, node.data_type);
          const pct = row.percentage === null || row.percentage === undefined ? null : Number(row.percentage);
          if (pct !== null && !(pct >= 0 && pct <= 100)) throw new Error('percentage must be 0-100');
          await Report.upsertMonthlyValue(c, pvId, node.id, month, year, { ...typed, percentage: pct });
          monthlyRows++;
        } catch (e) { errors.push(`Monthly row ${i + 2} (${code}): ${e.message}`); }
      }
      // all-or-nothing: any row error rolls the whole import back
      if (errors.length) throw Object.assign(new Error('Import validation failed'), { status: 422, details: errors.slice(0, 100) });
    });

    await ImportLog.finish(log.id, 'completed', `plan rows: ${planRows}, monthly rows: ${monthlyRows}`);
    success(res, { import_id: log.id, planRows, monthlyRows }, 'Import completed');
  } catch (err) {
    await ImportLog.finish(log.id, 'failed', err.details ? err.details.join('\n') : err.message);
    throw err;
  } finally {
    await cleanup();
  }
});

export const listImports = catchAsync(async (req, res) =>
  success(res, await ImportLog.list({ woreda_id: req.query.woreda_id })));
