import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/reports', label: 'Reports', end: true },
  { to: '/reports/sheet', label: 'All woredas & summaries' },
  { to: '/reports/periods', label: 'Reporting periods' },
];

/** Tab bar of the Reports area for zone level users and the admin. Hidden when printing. */
export default function ReportTabs() {
  return (
    <div role="tablist" className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700 print:hidden">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} role="tab"
          className={({ isActive }) => `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${isActive
            ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
