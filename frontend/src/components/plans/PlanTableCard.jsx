import { useState } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import { fmt } from '../../utils/planChecks.js';
import { tableToCsv, toExportBody } from '../../utils/planTable.js';
import { saveBlob, blobErrorMessage } from '../../utils/download.js';
import * as planService from '../../services/planService.js';
import { useNotify } from '../../context/NotificationContext.jsx';

/**
 * A plan table (see utils/planTable.js) with Download Excel / Download CSV / Print. When printing, only this
 * card is shown (everything else on the page is `print:hidden`), on a landscape page with the header repeated.
 */
export default function PlanTableCard({ table, title, emptyText = 'Nothing to show yet.' }) {
  const { error } = useNotify();
  const [busy, setBusy] = useState('');
  const hasRows = table.rows.length > 0;

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
    <Card
      title={title}
      className="plan-print print:border-0 print:bg-white print:p-0 print:shadow-none"
      actions={(
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" loading={busy === 'xlsx'} disabled={!!busy || !hasRows} onClick={() => download('xlsx')}>Download Excel</Button>
          <Button variant="secondary" loading={busy === 'csv'} disabled={!!busy || !hasRows} onClick={() => download('csv')}>Download CSV</Button>
          <Button variant="secondary" disabled={!hasRows} onClick={print}>Print</Button>
        </div>
      )}
    >
      <div className="mb-3 hidden print:block">
        <h2 className="text-lg font-semibold text-black">{table.title}</h2>
        {table.lines.map((l) => <p key={l} className="text-sm text-black">{l}</p>)}
      </div>
      {!hasRows ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="plan-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                {table.columns.map((c, i) => (
                  <th key={`${c}-${i}`} className={`border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600 ${i > table.indentColumn + 1 ? 'text-right' : ''}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={ri} className={r.bold ? 'bg-slate-50 font-semibold dark:bg-slate-900/40' : ''}>
                  {table.columns.map((_, i) => {
                    const v = r.cells[i];
                    const numeric = typeof v === 'number';
                    return (
                      <td key={i}
                        className={`border border-slate-300 px-2 py-1.5 align-top dark:border-slate-600 ${numeric || (r.bold && i > table.indentColumn + 1) ? 'text-right tabular-nums' : ''} ${i === 0 ? 'font-mono text-xs' : ''}`}
                        style={i === table.indentColumn ? { paddingLeft: 8 + Math.min(r.depth || 0, 10) * 16 } : undefined}>
                        {numeric ? fmt(v) : (v ?? '') === '' ? (i > table.indentColumn + 1 && !r.bold ? '—' : '') : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
