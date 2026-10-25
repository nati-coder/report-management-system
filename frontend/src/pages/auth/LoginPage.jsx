import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import useTheme from '../../hooks/useTheme.js';
import Button from '../../components/common/Button.jsx';
import { DASHBOARD_PATH } from '../../utils/roleHelpers.js';
import { errorMessage } from '../../services/api.js';
import { t } from '../../utils/formatters.js';

export default function LoginPage() {
  const { login, user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={DASHBOARD_PATH[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(form.email, form.password);
      navigate(DASHBOARD_PATH[u.role], { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <button onClick={toggleTheme} aria-label="Toggle dark mode"
        className="absolute right-4 top-4 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="Woreda-Zonal RMS logo" width="80" height="80" className="h-20 w-20" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Woreda-Zonal RMS</h1>
        </div>
        <div>
          <label className="label" htmlFor="email">{t('email')}</label>
          <input id="email" type="email" required autoComplete="username" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('password')}</label>
          <input id="password" type="password" required autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">{t('login')}</Button>
      </form>
    </div>
  );
}
