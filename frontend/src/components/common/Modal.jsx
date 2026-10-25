export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      {/* The panel never grows taller than the screen: the form scrolls, the title and the buttons stay in view. */}
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 -mx-1">{children}</div>
        {footer && <div className="mt-5 flex shrink-0 justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
