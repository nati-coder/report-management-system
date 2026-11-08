/**
 * Plan tables — the annual cascade overview and a woreda's monthly plan — as plain data, so the same table can be
 * shown on screen, printed, downloaded as CSV (built here) or sent to the server for an Excel file.
 *   table = { title, lines: [], sheet, indentColumn, columns: [header], rows: [{ cells, depth, bold }], fileName }
 * Numbers stay numbers; a missing value is null. "No." is written with a trailing dot (1. / 1.10.) like the report
 * format export, so a spreadsheet never reads "1.10" as the number 1.1.
 */
import { MONTHS, MONTH_NAMES, totalOf } from './planSplit.js';
import { slug } from './download.js';
import { indicatorsOf } from './formatTree.js';

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
/** The zone's monthly plan (what its woredas' cascaded monthly plans add up to) — same table shape as a woreda's monthly plan. */
export function zoneMonthlyPlanTable({ format, year, zoneName, items, zoneData, values, woredasCounted, woredasTotal }) {
  const zoneItems = items.filter((it) => zoneData[it.key] !== undefined);
  const rows = zoneItems.map((it) => {
    const months = Array.from({ length: MONTHS }, (_, m) => num(values[it.key]?.[m]));
    const total = it.isPercent ? null : totalOf(values[it.key]);
    const annual = Number(zoneData[it.key]);
    return {
      cells: [numberOf(it.key), it.title, it.measurement, annual, ...months, total, total === null ? null : r2(annual - total)],
      depth: it.depth || 0,
      bold: false,
    };
  });
  return {
    title: `${format.template_title} — zone monthly plan`,
    lines: [
      `Report version: ${format.version_name} (${format.version_year})`,
      `Team: ${format.team_name || '—'}  ·  Format v${format.version}`,
      `Zone: ${zoneName || '—'}  ·  Plan year: ${year}  ·  ${woredasCounted} of ${woredasTotal} woredas have a cascaded monthly plan`,
      "The months add up the woredas' cascaded monthly plans (percentages are rates, so they are averaged).",
    ],
    sheet: 'Zone monthly plan',
    indentColumn: 1,
    columns: ['No.', 'Item', 'Measurement', 'Zone annual', ...MONTH_NAMES, 'Total', 'Left'],
    rows,
    fileName: `${slug(format.template_title)}-${slug(zoneName || 'zone')}-${year}-zone-monthly`,
  };
}

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

/** Text and tone of a woreda's Report cell in the status row. */
export function reportStatusCell(w) {
  const counted = w.report && REPORT_COUNTED.includes(w.report.status);
  const text = w.report && !w.months && !counted ? `${reportStatusText(w)} (not counted)` : reportStatusText(w);
  let tone = 'muted';
  if (w.months) tone = w.months.reported === w.months.expected ? 'approved' : w.months.reported ? 'reviewing' : 'muted';
  else if (w.report) tone = w.report.status;
  return { text, tone };
}

const sum2 = (a) => r2(a.reduce((s, v) => s + (v ?? 0), 0));

/**
 * The rows of one format on the all-woredas sheet (items + a Status row). Rows carry `kind` ('item' | 'status') for
 * the screen; the export only needs cells / depth / bold.
 */
function reportSheetRows(items, woredas) {
  const planOf = (w, key) => num(w.plan?.data?.[key]);
  const reportOf = (w, key) => num((w.report && REPORT_COUNTED.includes(w.report.status) ? w.report : null)?.data?.[key]);
  const shown = items.filter((it) => woredas.some((w) => planOf(w, it.key) !== null || reportOf(w, it.key) !== null));
  const rows = shown.map((it) => {
    const plans = woredas.map((w) => planOf(w, it.key));
    const reps = woredas.map((w) => reportOf(w, it.key));
    const tPlan = it.isPercent ? null : sum2(plans);
    const tRep = it.isPercent ? null : sum2(reps);
    return {
      kind: 'item',
      cells: [numberOf(it.key), it.title, it.measurement, tPlan, tRep, tPlan ? r2((tRep / tPlan) * 100) : null, ...woredas.flatMap((_, i) => [plans[i], reps[i]])],
      depth: it.depth || 0, bold: false, percent: !!it.isPercent,
    };
  });
  const cells = woredas.map((w) => ({ plan: planStatusText(w), report: reportStatusCell(w), reportId: w.report?.id || null }));
  rows.push({
    kind: 'status',
    cells: ['', 'Status', '', '', '', '', ...cells.flatMap((c) => [c.plan, c.report.text])],
    statuses: cells, depth: 0, bold: true,
  });
  return { rows, hasData: shown.length > 0 };
}

/**
 * Every woreda's report on one sheet: per item the target (plan) and what was reported, for each woreda, with the
 * all-woredas totals and the share of the plan reached. Percentages are rates: shown per woreda, never added up.
 * `woredas` = [{ name, plan: { kind, data } | null, report: { status, data } | null }] from GET /reports/sheet.
 */
export function reportSheetTable({ format, year, periodLabel, zoneName, items, woredas, isSummary = false }) {
  const { rows } = reportSheetRows(items, woredas);
  return {
    title: `${format.template_title} — ${isSummary ? `${periodLabel} summary` : 'all woredas'}`,
    lines: [
      `Report version: ${format.version_name} (${format.version_year})`,
      `Team: ${format.team_name || '—'}  ·  Format v${format.version}`,
      `Zone: ${zoneName || 'All zones'}  ·  Year: ${year}${periodLabel ? `  ·  ${periodLabel}` : ''}`,
      REPORT_SHEET_NOTE(isSummary),
    ],
    sheet: 'All woredas',
    indentColumn: 1,
    woredaNames: woredas.map((w) => w.name),
    columns: ['No.', 'Item', 'Measurement', 'All woredas — Plan', 'All woredas — Report', 'Achieved %', ...woredas.flatMap((w) => [`${w.name} — Plan`, `${w.name} — Report`])],
    rows,
    fileName: `${slug(format.template_title)}-${year}${periodLabel ? `-${slug(periodLabel)}` : ''}-all-woredas`,
  };
}

const REPORT_SHEET_NOTE = (isSummary) => (isSummary
  ? 'Summed up from the monthly reports of these months (counts added, percentages averaged) against the monthly plans of the same months. Only submitted, in-review and approved monthly reports are counted.'
  : 'Plan is the accepted annual plan (a monthly report uses that month\'s plan when one is cascaded). Submitted, in-review and approved reports are counted; rejected or missing ones show "—".');

/**
 * All teams' reports in ONE table, titled with the report version's name (no team headings): every team's items follow
 * one another under the same Plan / Report columns per woreda, closed by one Status row that counts, per woreda, how many
 * of the teams' plans and reports are in. `sheets` = the GET /reports/sheet answers, one per team format.
 */
export function allTeamsReportTable({ year, periodLabel, zoneName, sheets, isSummary = false }) {
  const woredas = sheets[0]?.woredas || [];
  const rows = [];
  const per = woredas.map(() => ({ plans: 0, reports: 0, counted: 0 }));
  for (const sheet of sheets) {
    const { rows: block, hasData } = reportSheetRows(indicatorsOfSheet(sheet), sheet.woredas || []);
    (sheet.woredas || []).forEach((w, i) => {
      if (w.plan) per[i].plans += 1;
      if (w.months ? w.months.reported : (w.report && REPORT_COUNTED.includes(w.report.status))) per[i].reports += 1;
    });
    if (hasData) rows.push(...block.filter((r) => r.kind === 'item'));
  }
  const n = sheets.length;
  const statuses = per.map((c) => ({
    plan: `${c.plans} of ${n} plans`,
    report: { text: `${c.reports} of ${n} reports`, tone: c.reports === n && n ? 'approved' : c.reports ? 'reviewing' : 'muted' },
    reportId: null,
  }));
  rows.push({ kind: 'status', cells: ['', 'Status', '', '', '', '', ...statuses.flatMap((c) => [c.plan, c.report.text])], statuses, depth: 0, bold: true });
  const v = sheets[0]?.format;
  const versionName = v?.version_name || 'All teams';
  return {
    title: `${versionName} — ${isSummary ? `${periodLabel} summary` : 'all woredas'}`,
    versionName,
    lines: [
      `Report version: ${v ? `${v.version_name} (${v.version_year})` : '—'}  ·  ${n} team${n === 1 ? '' : 's'}`,
      `Zone: ${zoneName || 'All zones'}  ·  Year: ${year}${periodLabel ? `  ·  ${periodLabel}` : ''}`,
      REPORT_SHEET_NOTE(isSummary),
    ],
    sheet: 'All woredas',
    indentColumn: 1,
    woredaNames: woredas.map((w) => w.name),
    columns: ['No.', 'Item', 'Measurement', 'All woredas — Plan', 'All woredas — Report', 'Achieved %', ...woredas.flatMap((w) => [`${w.name} — Plan`, `${w.name} — Report`])],
    rows,
    fileName: `${slug(versionName)}-${year}${periodLabel ? `-${slug(periodLabel)}` : ''}-all-woredas`,
  };
}
const indicatorsOfSheet = (sheet) => indicatorsOf(sheet.format?.schema_definition);

/**
 * All teams' PLANS in ONE table, for one period: the zone plan and each woreda's plan per item, a heading row per team.
 *   blocks = [{ format, items, zone: { key: number }, byWoreda: { woreda_id: { key: number } }, states: { woreda_id: text } }]
 * "Annual": the zone's annual targets and each woreda's cascaded annual plan. A month: that month's plan of each woreda,
 * and the zone as the sum of its woredas (percentages averaged).
 */
export function allTeamsPlanTable({ year, periodLabel, zoneName, woredas, blocks }) {
  const rows = [];
  const planned = woredas.map(() => 0);
  for (const b of blocks) {
    const shown = b.items.filter((it) => b.zone[it.key] !== undefined || woredas.some((w) => b.byWoreda[w.woreda_id]?.[it.key] !== undefined));
    woredas.forEach((w, i) => { if (b.byWoreda[w.woreda_id]) planned[i] += 1; });
    for (const it of shown) {
      const per = woredas.map((w) => num(b.byWoreda[w.woreda_id]?.[it.key]));
      const total = it.isPercent ? null : sum2(per);
      rows.push({
        kind: 'item',
        cells: [numberOf(it.key), it.title, it.measurement, num(b.zone[it.key]), ...per, total],
        depth: it.depth || 0, bold: false, percent: !!it.isPercent,
      });
    }
  }
  rows.push({ kind: 'status', cells: ['', 'Status', '', '', ...planned.map((c) => `${c} of ${blocks.length} plans`), ''], depth: 0, bold: true });
  const f = blocks[0]?.format;
  const versionName = f?.version_name || 'All teams';
  return {
    title: `${versionName} — ${periodLabel} plan`,
    versionName,
    lines: [
      `Report version: ${f ? `${f.version_name} (${f.version_year})` : '—'}  ·  ${blocks.length} team${blocks.length === 1 ? '' : 's'}`,
      `Zone: ${zoneName || '—'}  ·  Plan year: ${year}  ·  ${periodLabel}`,
      'Only cascaded plans are counted for a month. A percentage is a rate, so it is not added up.',
    ],
    sheet: 'Plan',
    indentColumn: 1,
    columns: ['No.', 'Item', 'Measurement', 'Zone plan', ...woredas.map((w) => w.name), 'Total'],
    rows,
    fileName: `${slug(versionName)}-${year}-${slug(periodLabel)}-plan`,
  };
}
