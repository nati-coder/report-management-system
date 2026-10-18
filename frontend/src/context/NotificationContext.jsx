import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const useNotify = () => useContext(Ctx);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const api = useMemo(() => ({ notify: push, success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }), [push]);
  const colors = { info: 'bg-slate-800', success: 'bg-emerald-600', error: 'bg-red-600' };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2 print:hidden">
        {toasts.map((t) => (
          <div key={t.id} className={`${colors[t.type]} rounded-lg px-4 py-2 text-sm text-white shadow-lg`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
