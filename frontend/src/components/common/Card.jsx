export default function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="font-semibold text-slate-900 dark:text-slate-50">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
