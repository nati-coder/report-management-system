import { useState } from 'react';
import Button from '../common/Button.jsx';
import { tableToCsv, toExportBody } from '../../utils/planTable.js';
import { saveBlob, blobErrorMessage } from '../../utils/download.js';
import * as planService from '../../services/planService.js';
import { useNotify } from '../../context/NotificationContext.jsx';

/** Download Excel / Download CSV / Print for a plan table (see utils/planTable.js). Hidden when printing. */
export function TableActions({ table, disabled = false }) {
  const { error } = useNotify();
  const [busy, setBusy] = useState('');

  const download = async (type) => {
    setBusy(type);
    try {
      if (type === 'csv') saveBlob(new Blob([tableToCsv(table)], { type: 'text/csv;charset=utf-8' }), `${table.fileName}.csv`);
      else saveBlob(await planService.exportTable(toExportBody(table)), `${table.fileName}.xlsx`);
    } catch (err) { error(await blobErrorMessage(err)); } finally { setBusy(''); }
  };

  const print = () => {
    // Print on white whatever the theme: take dark mode off for the duration of the print dialog.
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    if (wasDark) {
      html.classList.remove('dark');
      const restore = () => { html.classList.add('dark'); window.removeEventListener('afterprint', restore); };
      window.addEventListener('afterprint', restore);
    }
    window.print();
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant="secondary" loading={busy === 'xlsx'} disabled={disabled || !!busy} onClick={() => download('xlsx')}>Download Excel</Button>
      <Button variant="secondary" loading={busy === 'csv'} disabled={disabled || !!busy} onClick={() => download('csv')}>Download CSV</Button>
      <Button variant="secondary" disabled={disabled} onClick={print}>Print</Button>
    </div>
  );
}

/** Title and info lines of a plan table — shown only on paper. */
export function PrintHeader({ table }) {
  return (
    <div className="mb-3 hidden print:block">
      <h2 className="text-lg font-semibold text-black">{table.title}</h2>
      {table.lines.map((l) => <p key={l} className="text-sm text-black">{l}</p>)}
    </div>
  );
}

/** Card classes that make a card the only thing on the printed page (landscape, plain). */
export const PRINT_CARD = 'plan-print print:border-0 print:bg-white print:p-0 print:shadow-none';
