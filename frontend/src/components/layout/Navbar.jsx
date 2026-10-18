import { useState } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useTheme from '../../hooks/useTheme.js';
import { getLang, setLang } from '../../utils/formatters.js';
import { ROLE_LABEL } from '../../utils/roleHelpers.js';
import Button from '../common/Button.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [lang, setL] = useState(getLang());
  const toggleLang = () => { const n = lang === 'en' ? 'am' : 'en'; setLang(n); setL(n); window.location.reload(); };
  return (
    <header className="print:hidden z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-800">
      <span className="font-semibold text-brand-700 dark:text-brand-400">Woreda-Zonal RMS</span>
      <div className="flex items-center gap-4 text-sm">
        <button onClick={toggleTheme} aria-label="Toggle dark mode"
          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <button onClick={toggleLang} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
          {lang === 'en' ? 'አማ' : 'EN'}
        </button>
        <span className="text-slate-600 dark:text-slate-300">{user?.name} · {ROLE_LABEL[user?.role]?.[lang]}</span>
        <Button variant="secondary" onClick={logout}>Sign out</Button>
      </div>
    </header>
  );
}
