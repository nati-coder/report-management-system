import ExcelJS from 'exceljs';

/**
 * Excel export of a plan table shown on screen (the annual cascade overview, or a woreda's monthly plan).
 * The browser sends the table it is showing — title, a few info lines, column headers and rows — so the file is
 * exactly what the expert sees, including a monthly plan that has not been saved yet.
 *   table = { title, lines: [], sheet?, indentColumn?, columns: [header], rows: [{ cells: [string|number|null], depth, bold }] }
 * Numbers stay numbers (so Excel can sum them); text is always written as text, never as a formula.
 */
const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const safeSheet = (name) => (String(name || 'Plan').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Plan');

export async function buildTableXlsx(table) {
  const { title, lines = [], columns, rows } = table;
  const indentColumn = table.indentColumn ?? 1;
  const nCols = columns.length;
  const HEADER_ROW = lines.length + 3; // title, info lines, a blank row, then the header

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Woreda-Zonal RMS';
  wb.created = new Date();
  const ws = wb.addWorksheet(safeSheet(table.sheet), {
    views: [{ state: 'frozen', xSplit: Math.min(indentColumn + 1, nCols), ySplit: HEADER_ROW }],
    pageSetup: {
      paperSize: 9, orientation: nCols > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: `&L${safeSheet(table.sheet)}&CPage &P of &N&R&D` },
  });

  columns.forEach((_, i) => { ws.getColumn(i + 1).width = i === indentColumn ? 48 : i === 0 ? 8 : i === indentColumn + 1 ? 18 : 14; });

  const lastCol = ws.getColumn(nCols).letter;
  ws.mergeCells(`A1:${lastCol}1`); ws.getCell('A1').value = title; ws.getCell('A1').font = { bold: true, size: 14 };
  lines.forEach((l, i) => {
    ws.mergeCells(`A${i + 2}:${lastCol}${i + 2}`);
    ws.getCell(`A${i + 2}`).value = l;
    ws.getCell(`A${i + 2}`).font = { color: { argb: 'FF555555' } };
  });

  const head = ws.getRow(HEADER_ROW);
  head.values = columns;
  head.eachCell((c) => {
    c.font = { bold: true };
    c.fill = fill('FFE5E7EB');
    c.border = border;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(HEADER_ROW + 1 + i);
    row.values = r.cells.map((v) => (v === null || v === undefined ? '' : v));
    for (let col = 1; col <= nCols; col += 1) {
      const c = row.getCell(col);
      const isNum = typeof c.value === 'number';
      c.border = border;
      c.alignment = {
        vertical: 'top', wrapText: true, horizontal: isNum ? 'right' : 'left',
        ...(col === indentColumn + 1 ? { indent: Math.min(r.depth || 0, 15) } : {}),
      };
      if (isNum) c.numFmt = '#,##0.##';
      if (r.bold) { c.font = { bold: true }; c.fill = fill('FFF3F4F6'); }
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
