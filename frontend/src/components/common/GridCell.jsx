/**
 * A spreadsheet-style number cell: no box of its own, a green outline when selected, content selected on focus.
 * Keyboard like Excel — arrows / Enter / Shift+Enter move between cells of the same table (Left/Right when the caret
 * is at the edge), Tab moves along — and you can paste a block copied from Excel (tab- and line-separated) to fill
 * the cells from this one onwards. Only digits and one decimal point are accepted. Cells are found by their
 * data-gr / data-gc (row / column) inside the nearest <table>; a disabled cell is skipped. When printing, the cell
 * is shown as plain text.
 */
const NUMBER = /^\d*\.?\d*$/;
const cellAt = (table, r, c) => table.querySelector(`input[data-gr="${r}"][data-gc="${c}"]:not([disabled])`);
const setNative = (el, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true })); // lets React's onChange see it
};

export default function GridCell({ value, onChange, r, c, disabled = false, label, invalid = false }) {
  const move = (el, dr, dc) => {
    const table = el.closest('table');
    if (!table) return false;
    let nr = r + dr; let nc = c + dc;
    for (let i = 0; i < 60 && nr >= 0 && nc >= 0; i += 1, nr += dr, nc += dc) {
      const target = cellAt(table, nr, nc);
      if (target) { target.focus(); return true; }
    }
    return false;
  };

  const onKeyDown = (e) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    const all = el.selectionStart === 0 && el.selectionEnd === el.value.length;
    let moved = false;
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) moved = move(el, 1, 0);
    else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) moved = move(el, -1, 0);
    else if (e.key === 'ArrowRight' && (atEnd || all)) moved = move(el, 0, 1);
    else if (e.key === 'ArrowLeft' && (atStart || all)) moved = move(el, 0, -1);
    else return;
    if (moved || e.key.startsWith('Arrow')) e.preventDefault();
  };

  const onPaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\r\n]/.test(text.trim())) return; // a single value pastes as usual
    const table = e.currentTarget.closest('table');
    if (!table) return;
    e.preventDefault();
    text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').forEach((line, i) => {
      line.split('\t').forEach((raw, j) => {
        const v = raw.replace(/[\s,%]/g, '');
        const target = cellAt(table, r + i, c + j);
        if (target && NUMBER.test(v)) setNative(target, v);
      });
    });
  };

  return (
    <>
      <input
        type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
        className={`grid-cell print:hidden ${invalid ? 'invalid' : ''}`}
        data-gr={r} data-gc={c} disabled={disabled} aria-label={label} value={value}
        onChange={(e) => { if (NUMBER.test(e.target.value)) onChange(e.target.value); }}
        onFocus={(e) => e.target.select()} onKeyDown={onKeyDown} onPaste={onPaste}
      />
      <span className="hidden px-1 text-right tabular-nums print:block">{value}</span>
    </>
  );
}
