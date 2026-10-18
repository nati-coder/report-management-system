import XLSX from 'xlsx';

/**
 * Expected workbook layout (header row required, case-insensitive):
 *   Sheet "Plan"    : node_code | value | remarks
 *   Sheet "Monthly" : node_code | month | year | value | percentage   (optional)
 * `value` is coerced according to the node's data_type in report_formats.
 */
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '_');

function readSheet(wb, name) {
  const key = wb.SheetNames.find((n) => norm(n) === name);
  if (!key) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[key], { defval: null, raw: true });
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), v])));
}

export function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const plan = readSheet(wb, 'plan');
  const monthly = readSheet(wb, 'monthly');
  if (!plan.length && !monthly.length) {
    throw Object.assign(new Error('Workbook must contain a non-empty "Plan" or "Monthly" sheet'), { status: 400 });
  }
  return { plan, monthly };
}

/** Coerce raw cell into the typed value columns for plan_values */
export function coerceValue(raw, dataType) {
  if (raw === null || raw === undefined || raw === '') return {};
  switch (dataType) {
    case 'number': case 'currency': case 'percentage': case 'calculated': {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[,%\s]/g, ''));
      if (Number.isNaN(n)) throw new Error(`"${raw}" is not numeric`);
      return { numeric: n };
    }
    case 'date': {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(d.getTime())) throw new Error(`"${raw}" is not a valid date`);
      return { date: d.toISOString().slice(0, 10) };
    }
    case 'boolean':
      return { boolean: ['true', 'yes', '1', 'አዎ'].includes(String(raw).trim().toLowerCase()) };
    default:
      return { text: String(raw) };
  }
}
