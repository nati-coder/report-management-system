/**
 * Plan tables — the annual cascade overview and a woreda's monthly plan — as plain data, so the same table can be
 * shown on screen, printed, downloaded as CSV (built here) or sent to the server for an Excel file.
 *   table = { title, lines: [], sheet, indentColumn, columns: [header], rows: [{ cells, depth, bold }], fileName }
 * Numbers stay numbers; a missing value is null. "No." is written with a trailing dot (1. / 1.10.) like the report
 * format export, so a spreadsheet never reads "1.10" as the number 1.1.
 */
import { MONTHS, MONTH_NAMES, totalOf } from './planSplit.js';
import { slug } from './download.js';

const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const numberOf = (key) => (/^\d+(\.\d+)*$/.test(key) ? `${key}.` : '');

const WOREDA_STATUS = { draft: 'draft', submitted: 'cascaded', approved: 'accepted', rejected: 'rejected' };

/**
 * Annual cascade table: every item of the zone plan against each woreda of the zone, with the total and what is
 * still left of the zone plan, and a Status row. It follows the screen: every saved plan counts (drafts included),
 * and for the woreda being edited (`live` = { woredaId, nums }) the numbers typed so far.
 */
export function annualCascadeTable({ format, year, zoneName, items, zoneData, woredas, plans, live }) {
  const zoneItems = items.filter((it) => zoneData[it.key] !== undefined);
  const planOf = (id) => plans.find((p) => p.woreda_id === id);
  const valueOf = (w, key) => (live && live.woredaId === w.woreda_id ? num(live.nums?.[key]) : num(planOf(w.woreda_id)?.data?.[key]));

  const rows = zoneItems.map((it) => {
    const per = woredas.map((w) => valueOf(w, it.key));
    const total = it.isPercent ? null : r2(per.reduce((s, v) => s + (v ?? 0), 0));
    const zone = Number(zoneData[it.key]);
    return {
      cells: [numberOf(it.key), it.title, it.measurement, zone, ...per, total, total === null ? null : r2(zone - total)],
      depth: it.depth || 0,
      bold: false,
    };
  });
  rows.push({
    cells: ['', 'Status', '', '', ...woredas.map((w) => { const p = planOf(w.woreda_id); return p ? WOREDA_STATUS[p.status] : 'not started'; }), '', ''],
    depth: 0, bold: true,
  });

  return {
    title: `${format.template_title} — annual plan cascade`,
    lines: [
      `Report version: ${format.version_name} (${format.version_year})`,
      `Team: ${format.team_name || '—'}  ·  Format v${format.version}`,
      `Zone: ${zoneName || '—'}  ·  Plan year: ${year}`,
      'Drafts are included and the Status row shows where each woreda stands. A percentage is a rate, so it is not added up.',
    ],
    sheet: 'Annual cascade',
    indentColumn: 1,
    columns: ['No.', 'Item', 'Measurement', 'Zone plan', ...woredas.map((w) => w.name), 'Total', 'Left'],
    rows,
    fileName: `${slug(format.template_title)}-${year}-annual-cascade`,
  };
}

/** A woreda's monthly plan: each item's annual target, its twelve months, the total and what is left. */
export function monthlyPlanTable({ format, year, zoneName, woreda, statusLabel, items, annualData, values }) {
  const annualItems = items.filter((it) => annualData[it.key] !== undefined);
  const rows = annualItems.map((it) => {
    const months = Array.from({ length: MONTHS }, (_, m) => num(values[it.key]?.[m]));
    const total = it.isPercent ? null : totalOf(values[it.key]);
    const annual = Number(annualData[it.key]);
    return {
      cells: [numberOf(it.key), it.title, it.measurement, annual, ...months, total, total === null ? null : r2(annual - total)],
      depth: it.depth || 0,
      bold: false,
    };
  });
  return {
    title: `${format.template_title} — monthly plan`,
    lines: [
      `Report version: ${format.version_name} (${format.version_year})`,
      `Team: ${format.team_name || '—'}  ·  Format v${format.version}`,
      `Woreda: ${woreda.name}  ·  Zone: ${zoneName || '—'}  ·  Plan year: ${year}${statusLabel ? `  ·  ${statusLabel}` : ''}`,
    ],
    sheet: 'Monthly plan',
    indentColumn: 1,
    columns: ['No.', 'Item', 'Measurement', 'Annual', ...MONTH_NAMES, 'Total', 'Left'],
    rows,
    fileName: `${slug(format.template_title)}-${slug(woreda.name)}-${year}-monthly`,
  };
}

/** Spreadsheet apps run cells that start with = + - @ (tab/CR) as formulas — neutralise those. */
const guard = (v) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCell = (v) => {
  const t = typeof v === 'number' ? String(v) : guard(String(v ?? ''));
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** UTF-8 with a BOM so Excel shows Amharic (and any non-ASCII) text correctly. Just the table — no title lines. */
export function tableToCsv(table) {
  const lines = [table.columns, ...table.rows.map((r) => table.columns.map((_, i) => r.cells[i] ?? ''))].map((l) => l.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** What the API's /plans/export takes. */
export const toExportBody = (t) => ({
  title: t.title, lines: t.lines, sheet: t.sheet, indentColumn: t.indentColumn, columns: t.columns,
  rows: t.rows.map(({ cells, depth, bold }) => ({ cells, depth, bold })),
});

/** Report statuses that count in the all-woredas sheet (a draft is the woreda's own copy; a rejected report isn't final). */
export const REPORT_COUNTED = ['submitted', 'reviewing', 'approved', 'summary'];
const REPORT_LABEL = { submitted: 'submitted', reviewing: 'in review', approved: 'approved', rejected: 'rejected' };

/** What a woreda's Report column says in the status row: its report's status, or for a summary how many months it covers. */
export function reportStatusText(w) {
  if (w.months) return w.months.reported ? `${w.months.reported} of ${w.months.expected} months` : 'no reports';
  return w.report ? REPORT_LABEL[w.report.status] || w.report.status : 'no report';
}
export const planStatusText = (w) => (w.plan ? (w.plan.kind === 'monthly' && w.plan.months ? `monthly plan (${w.plan.months})` : `${w.plan.kind} plan`) : 'no plan');

/**
 * Every woreda's report on one sheet: per item the target (plan) and what was reported, for each woreda, with the
 * all-woredas totals and the share of the plan reached. Percentages are rates: shown per woreda, never added up.
 * `woredas` = [{ name, plan: { kind, data } | null, report: { status, data } | null }] from GET /reports/sheet.
 */
export function reportSheetTable({ format, year, periodLabel, zoneName, items, woredas, isSummary = false }) {
  const counted = (w) => (w.report && REPORT_COUNTED.includes(w.report.status) ? w.report : null);
  const planOf = (w, key) => num(w.plan?.data?.[key]);
  const reportOf = (w, key) => num(counted(w)?.data?.[key]);
  const shown = items.filter((it) => woredas.some((w) => planOf(w, it.key) !== null || reportOf(w, it.key) !== null));

  const rows = shown.map((it) => {
    const plans = woredas.map((w) => planOf(w, it.key));
    const reps = woredas.map((w) => reportOf(w, it.key));
    const sum = (a) => r2(a.reduce((s, v) => s + (v ?? 0), 0));
    const tPlan = it.isPercent ? null : sum(plans);
    const tRep = it.isPercent ? null : sum(reps);
    return {
      cells: [numberOf(it.key), it.title, it.measurement, tPlan, tRep, tPlan ? r2((tRep / tPlan) * 100) : null, ...woredas.flatMap((_, i) => [plans[i], reps[i]])],
      depth: it.depth || 0,
      bold: false,
      percent: !!it.isPercent,
    };
  });
  rows.push({
    cells: ['', 'Status', '', '', '', '', ...woredas.flatMap((w) => [
      planStatusText(w),
      reportStatusText(w),
    ])],
    depth: 0, bold: true,
  });

  return {
    title: `${format.template_title} — ${isSummary ? `${periodLabel} summary` : 'all woredas'}`,
    lines: [
      `Report version: ${format.version_name} (${format.version_year})`,
      `Team: ${format.team_name || '—'}  ·  Format v${format.version}`,
      `Zone: ${zoneName || 'All zones'}  ·  Year: ${year}${periodLabel ? `  ·  ${periodLabel}` : ''}`,
      isSummary
        ? 'Summed up from the monthly reports of these months (counts added, percentages averaged) against the monthly plans of the same months. Only submitted, in-review and approved monthly reports are counted.'
        : 'Plan is the accepted annual plan (a monthly report uses that month\'s plan when one is cascaded). Submitted, in-review and approved reports are counted; rejected or missing ones show "—".',
    ],
    sheet: 'All woredas',
    indentColumn: 1,
    columns: ['No.', 'Item', 'Measurement', 'All woredas — Plan', 'All woredas — Report', 'Achieved %', ...woredas.flatMap((w) => [`${w.name} — Plan`, `${w.name} — Report`])],
    rows,
    fileName: `${slug(format.template_title)}-${year}${periodLabel ? `-${slug(periodLabel)}` : ''}-all-woredas`,
  };
}
