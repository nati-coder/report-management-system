import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header.jsx';
import AnnualPlanTab from './CascadePlanPage.jsx';
import MonthlyPlanTab from './MonthlyPlanTab.jsx';

const TABS = [
  { key: 'annual', label: 'Annual Plan' },
  { key: 'monthly', label: 'Monthly Plan' },
];

/** Zonal Expert: Plan. Two tabs — Annual Plan (zone plan + woreda cascade) and Monthly Plan (each woreda's annual plan divided across the months). */
export default function PlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'annual';

  const selectTab = (key) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', key);
    return next;
  }, { replace: true });

  return (
    <>
      <div className="print:hidden"><Header title="Plan" /></div>

      <div role="tablist" className="print:hidden mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.key} type="button" role="tab" aria-selected={active === t.key}
            onClick={() => selectTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${active === t.key
              ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Annual Plan stays mounted (just hidden) so its selections aren't lost when switching tabs. */}
      <div role="tabpanel" hidden={active !== 'annual'}><AnnualPlanTab /></div>
      {active === 'monthly' && <div role="tabpanel"><MonthlyPlanTab /></div>}
    </>
  );
}
