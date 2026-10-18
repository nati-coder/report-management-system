import ExcelJS from 'exceljs';

/**
 * Export of an approved report format as CSV or Excel.
 * Columns: No. | Title | Measurement. The number is written with a trailing dot (1. / 1.1. / 1.1.10.) —
 * that is how the outline is numbered on screen, and it also stops Excel from reading "1.10" as the
 * number 1.1 (which would make 1.10 indistinguishable from 1.1).
 */
const HEADERS = ['No.', 'Title', 'Measurement'];
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

export function describe(format) {
  return {
    title: format.template_title,
    version: `Report version: ${format.version_name} (${format.version_year})`,
    detail: `Team: ${format.team_name || '—'}  ·  Format v${format.version}  ·  Approved ${dateOnly(format.approved_at)}`,
  };
}

/** Spreadsheet apps run cells that start with = + - @ (tab/CR) as formulas — neutralise those in CSV. */
const guard = (v) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCell = (v) => {
  const t = guard(String(v ?? ''));
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** UTF-8 with a BOM so Excel shows Amharic (and any non-ASCII) text correctly. */
export function buildCsv(rows) {
  const lines = [HEADERS, ...rows.map((r) => [`${r.code}.`, r.title, r.measurement])].map((l) => l.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export async function buildXlsx(format, rows) {
  const info = describe(format);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Woreda-Zonal RMS';
  wb.created = new Date();

  const HEADER_ROW = 5;
  const ws = wb.addWorksheet('Report format', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: '&LReport format&CPage &P of &N&R&D' },
  });
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 72;
  ws.getColumn(3).width = 24;

  ws.mergeCells('A1:C1'); ws.getCell('A1').value = info.title; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A2:C2'); ws.getCell('A2').value = info.version;
  ws.mergeCells('A3:C3'); ws.getCell('A3').value = info.detail; ws.getCell('A3').font = { color: { argb: 'FF555555' } };

  const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  const head = ws.getRow(HEADER_ROW);
  head.values = HEADERS;
  head.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    c.border = border;
    c.alignment = { vertical: 'middle' };
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(HEADER_ROW + 1 + i);
    row.values = [`${r.code}.`, r.title, r.measurement]; // strings, so Excel never reinterprets "1.10." as a number
    const heading = !r.measurement;
    row.eachCell((c, col) => {
      c.border = border;
      c.alignment = { vertical: 'top', wrapText: true, horizontal: 'left', ...(col === 2 ? { indent: Math.min(r.depth, 15) } : {}) };
      if (heading) {
        c.font = { bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
