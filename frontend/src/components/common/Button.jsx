const styles = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-100 disabled:text-brand-500 dark:disabled:bg-brand-950 dark:disabled:text-brand-700',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};
export default function Button({ variant = 'primary', className = '', loading = false, children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${styles[variant]} ${className}`}
    >
      {loading ? '…' : children}
    </button>
  );
}
