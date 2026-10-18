import { useMemo } from 'react';
import Button from '../common/Button.jsx';
import { formatRows } from '../../utils/formatTree.js';
import { formatDate } from '../../utils/formatters.js';

/**
 * Table preview of an approved report format — No. | Title | Measurement — that can be
 * downloaded as Excel / CSV or printed. When printing, only this card is shown (the rest of the
 * app is hidden by `print:hidden` and the print rules in index.css).
 */
export default function FormatTableCard({ format, onDownload, downloading = '' }) {
  const rows = useMemo(() => formatRows(format.schema_definition), [format]);

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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 print:border-0 print:bg-white print:p-0 print:shadow-none">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 print:text-black">{format.template_title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 print:text-black">Report version: {format.version_name} ({format.version_year})</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 print:text-black">
            Team: {format.team_name || '—'} · Format v{format.version}{format.approved_at ? ` · Approved ${formatDate(format.approved_at)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" loading={downloading === 'xlsx'} disabled={!!downloading} onClick={() => onDownload('xlsx')}>Download Excel</Button>
          <Button variant="secondary" loading={downloading === 'csv'} disabled={!!downloading} onClick={() => onDownload('csv')}>Download CSV</Button>
          <Button variant="secondary" onClick={print}>Print</Button>
        </div>
      </div>

      {!rows.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">This format has no items.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="format-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                <th className="w-24 border border-slate-300 px-3 py-2 font-semibold dark:border-slate-600">No.</th>
                <th className="border border-slate-300 px-3 py-2 font-semibold dark:border-slate-600">Title</th>
                <th className="w-48 border border-slate-300 px-3 py-2 font-semibold dark:border-slate-600">Measurement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className={r.measurement ? '' : 'bg-slate-50 font-semibold dark:bg-slate-900/40'}>
                  <td className="border border-slate-300 px-3 py-2 align-top font-mono text-xs dark:border-slate-600">{r.code}.</td>
                  <td className="border border-slate-300 py-2 pr-3 align-top dark:border-slate-600" style={{ paddingLeft: 12 + Math.min(r.depth, 10) * 20 }}>{r.title}</td>
                  <td className="border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{r.measurement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
