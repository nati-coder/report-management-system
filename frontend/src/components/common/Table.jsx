/** columns: [{ key, header, render?(row) }] */
export default function Table({ columns, rows, empty = 'No records found', onRowClick }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
          <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows?.length ? rows.map((row, i) => (
            <tr key={row.id ?? i} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : ''}>
              {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(row) : row[c.key] ?? '—'}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
