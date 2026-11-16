import { useState } from 'react';
import Card from '../common/Card.jsx';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import {
  flattenTree, newNode, updateNode, removeNode, insertNode, moveNode, indentNode, outdentNode, getNode, countDescendants, sumBlocker, isPercent, chosenSources, splitNode,
  canMove, canIndent, canOutdent, belowIndex, parentCodeOf, syncSplits, updateRow,
} from '../../utils/formatTree.js';

const SUGGESTIONS = ['%', 'Number', 'Persons', 'Households', 'ETB', 'Hectares', 'Quintals', 'Km', 'Cases'];

function Act({ label, title, onClick, disabled, danger }) {
  return (
    <button
      type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30 ${danger
        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
    >
      {label}
    </button>
  );
}

/**
 * Outline editor for a report format: items numbered 1. / 1.1. / 1.1.1. … that nest without limit.
 * Each item has a title, a measurement and — for items with a measurement — "Is sum of sub-items?" (Yes / No).
 * Yes = the value is calculated from the sub-items automatically; No = it is entered by hand. Controlled — pass `nodes` + `setNodes` and the
 * `errors` from validateTree() (keyed by item code).
 */
export default function TreeBuilderCard({ nodes, setNodes, errors = {}, readOnly = false, title = 'Items' }) {
  const [split, setSplit] = useState(null); // { path, labels, measurement, includeSubitems, autoSum, error }
  const openSplit = (path) => {
    const node = getNode(nodes, path);
    setSplit({ path, labels: 'Male, Female', measurement: node.measurement?.trim() || 'Persons', includeSubitems: node.children.some((c) => !c.row), autoSum: true, error: '' });
  };
  const applySplit = () => {
    const r = splitNode(nodes, split.path, { labels: split.labels.split(','), measurement: split.measurement, includeSubitems: split.includeSubitems, autoSum: split.autoSum });
    if (r.error) return setSplit((x) => ({ ...x, error: r.error }));
    setNodes(r.nodes);
    setSplit(null);
  };
  const rows = flattenTree(nodes);
  const byId = new Map(rows.map((r) => [r.node._id, r.node]));
  // how an item is named in "Calculated from": its number, or — for a Male / Female row — the row and the item it belongs to
  const nameOf = (r) => (r.node.row ? `${r.node.title || 'row'} of ${parentCodeOf(r.code)}` : r.code);
  const nameOfId = new Map(rows.map((r) => [r.node._id, nameOf(r)]));
  const sameUnit = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

  const addRoot = () => setNodes((n) => [...n, newNode({ _focus: true })]);
  const addChild = (path) => setNodes((n) => syncSplits(insertNode(n, path, getNode(n, path).children.length, newNode({ _focus: true }))));
  const addBelow = (path) => setNodes((n) => syncSplits(insertNode(n, path.slice(0, -1), belowIndex(n, path), newNode({ _focus: true }))));
  const remove = (path) => {
    const node = getNode(nodes, path);
    const kids = countDescendants(node);
    if (kids && !window.confirm(`Remove "${node.title || 'this item'}" and its ${kids} sub-item${kids === 1 ? '' : 's'}?`)) return;
    setNodes((n) => syncSplits(removeNode(n, path)));
  };

  return (
    <Card title={`${title} (${rows.length})`} actions={!readOnly && <Button variant="secondary" onClick={addRoot}>Add item</Button>}>
      {!readOnly && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Lay the report out as it is on paper: items nest without limit (1. → 1.1. → 1.1.1. …). The <strong>measurement</strong> is the unit a value is
          reported in (e.g. %, Number, ETB). Leave it blank for a heading that has no value of its own. <strong>Is sum of sub-items?</strong> — choose Yes and the item's value is
          calculated automatically from its sub-items (they must use the same measurement; a percentage can't be a sum); choose No to enter it by hand.
          A sum normally adds up its own sub-items; open <strong>Calculated from</strong> to make it add up other items instead — for example <em>Total male</em> = the male item of each branch (they can be anywhere in the format and must use the same measurement).
          On a Male / Female row, choosing Yes gives every sub-item the same row automatically (same name and measurement) and adds them up — including sub-items you add later. Press Enter in a title to add the next item.
        </p>
      )}
      {errors._tree && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{errors._tree}</p>}
      <datalist id="measurement-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>

      {!rows.length && <p className="text-sm text-slate-500 dark:text-slate-400">No items yet.</p>}

      <div className="space-y-1">
        {rows.map(({ node, path, code, num, depth }) => {
          const hasUnit = !!node.measurement?.trim();
          const canSum = hasUnit && !isPercent(node.measurement);
          const chosen = chosenSources(node, byId);
          const blocker = hasUnit ? sumBlocker(node) : 'a heading has no value of its own, so it cannot be a sum';
          const candidates = canSum ? rows.filter((r) => r.node._id !== node._id && r.node.measurement?.trim() && sameUnit(r.node.measurement, node.measurement)) : [];
          const toggle = (id) => setNodes((n) => updateNode(n, path, { sum_of_ids: (node.sum_of_ids || []).includes(id) ? node.sum_of_ids.filter((x) => x !== id) : [...(node.sum_of_ids || []), id] }));
          return (
            <div key={node._id} style={{ marginLeft: Math.min(depth, 8) * 20 }}>
              <div className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 ${node.measurement ? '' : 'bg-slate-50 dark:bg-slate-900/40'}`}>
                <span className="w-20 shrink-0 text-right font-mono text-xs text-slate-500 dark:text-slate-400" aria-label={node.row ? `Row ${code}` : `Item ${code}`}>{node.row ? 'row' : num}</span>
                <input
                  className="input min-w-[12rem] flex-1" placeholder="Title" disabled={readOnly} autoFocus={!!node._focus}
                  value={node.title} aria-label={`Title of item ${code}`}
                  onChange={(e) => setNodes((n) => updateRow(n, path, { title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !readOnly) { e.preventDefault(); addBelow(path); } }}
                />
                <input
                  className="input w-44" placeholder="Measurement" list="measurement-suggestions" disabled={readOnly}
                  value={node.measurement} aria-label={`Measurement of item ${code}`}
                  onChange={(e) => setNodes((n) => updateRow(n, path, { measurement: e.target.value }))}
                />
                {node.measurement?.trim() && (readOnly ? (
                  node.sum_of_subitems && <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{chosen.length ? `Sum of ${chosen.map((c) => nameOfId.get(c._id)).join(', ')}` : 'Sum of sub-items'}</span>
                ) : (
                  <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="whitespace-nowrap">Sum of sub-items?</span>
                    <select
                      className="input w-20 py-1" aria-label={`Is item ${code} the sum of its sub-items?`}
                      title={!canSum ? `Not available: ${blocker}` : 'Yes: calculated from its sub-items (or the items you choose). No: entered by hand.'}
                      value={node.sum_of_subitems ? 'yes' : 'no'}
                      onChange={(e) => setNodes((n) => syncSplits(updateNode(n, path, { sum_of_subitems: e.target.value === 'yes' })))}
                    >
                      <option value="no">No</option>
                      <option value="yes" disabled={!canSum && !node.sum_of_subitems}>Yes</option>
                    </select>
                  </label>
                ))}
                {!readOnly && (
                  <div className="flex flex-wrap items-center">
                    <Act label="↑" title={`Move ${code} up`} disabled={!canMove(nodes, path, -1)} onClick={() => setNodes((n) => moveNode(n, path, -1))} />
                    <Act label="↓" title={`Move ${code} down`} disabled={!canMove(nodes, path, 1)} onClick={() => setNodes((n) => moveNode(n, path, 1))} />
                    <Act label="←" title={`Outdent ${code}`} disabled={!canOutdent(nodes, path)} onClick={() => setNodes((n) => syncSplits(outdentNode(n, path)))} />
                    <Act label="→" title={`Indent ${code}`} disabled={!canIndent(nodes, path)} onClick={() => setNodes((n) => syncSplits(indentNode(n, path)))} />
                    {!node.row && <Act label="Split…" title={`Split ${code} into rows such as Male / Female`} onClick={() => openSplit(path)} />}
                    {!node.row && <Act label="+ Sub-item" title={`Add a sub-item under ${code}`} onClick={() => addChild(path)} />}
                    <Act label="+ Below" title={`Add an item below ${code}`} onClick={() => addBelow(path)} />
                    <Act label="Remove" title={`Remove ${code}`} danger onClick={() => remove(path)} />
                  </div>
                )}
              </div>
              {!readOnly && node.sum_of_subitems && canSum && (
                <details className="ml-24 mt-1 text-xs">
                  <summary className="cursor-pointer text-slate-600 dark:text-slate-300">
                    Calculated from: {chosen.length ? chosen.map((c) => nameOfId.get(c._id)).join(', ') : (node.children.some((c) => c.row) ? 'its rows' : 'its sub-items')}
                  </summary>
                  <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400">
                      Tick the items this one adds up. Leave all unticked to add up its own sub-items.
                    </p>
                    {candidates.map((cand) => { const c = cand.node; return (
                      <label key={c._id} className="flex items-center gap-2">
                        <input type="checkbox" checked={(node.sum_of_ids || []).includes(c._id)} onChange={() => toggle(c._id)} />
                        <span className="font-mono text-slate-500 dark:text-slate-400">{c.row ? `${parentCodeOf(cand.code)} ›` : `${cand.code}.`}</span>
                        <span>{c.title || '(untitled)'}</span>
                      </label>
                    ); })}
                    {!candidates.length && <p className="text-slate-500 dark:text-slate-400">No other item uses the measurement “{node.measurement.trim()}”.</p>}
                    {chosen.length > 0 && (
                      <button type="button" className="text-emerald-700 underline dark:text-emerald-300" onClick={() => setNodes((n) => updateNode(n, path, { sum_of_ids: [] }))}>
                        Use its sub-items instead
                      </button>
                    )}
                  </div>
                </details>
              )}
              {!readOnly && node.sum_of_subitems && hasUnit && !chosen.length && blocker && !errors[code] && <p className="ml-24 text-xs text-amber-600 dark:text-amber-400">Cannot be a sum yet — {blocker}. Add sub-items, or open “Calculated from” and tick the items to add up.</p>}
              {errors[code] && <p className="ml-24 text-xs text-red-600 dark:text-red-400">{errors[code]}</p>}
            </div>
          );
        })}
      </div>
      <Modal
        open={!!split} onClose={() => setSplit(null)} title="Split into rows"
        footer={<><Button variant="secondary" onClick={() => setSplit(null)}>Cancel</Button><Button onClick={applySplit}>Add rows</Button></>}
      >
        {split && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-500 dark:text-slate-400">
              Adds the rows below to this item — for example Male and Female under “Total employee”. Rows are not numbered: the item and its sub-items keep their numbers (1., 1.1., 1.2. …) and each one gets its own Male and Female. Use it only on the items that need it.
            </p>
            <label className="block">
              <span className="mb-1 block font-medium">Row names (separated by commas)</span>
              <input className="input" value={split.labels} onChange={(e) => setSplit((x) => ({ ...x, labels: e.target.value, error: '' }))} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Measurement</span>
              <input className="input" list="measurement-suggestions" value={split.measurement} onChange={(e) => setSplit((x) => ({ ...x, measurement: e.target.value, error: '' }))} />
            </label>
            {getNode(nodes, split.path).children.some((c) => !c.row) && (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={split.includeSubitems} onChange={(e) => setSplit((x) => ({ ...x, includeSubitems: e.target.checked }))} />
                <span>Add the same rows to each of its sub-items too (e.g. head office and college)</span>
              </label>
            )}
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5" checked={split.autoSum} onChange={(e) => setSplit((x) => ({ ...x, autoSum: e.target.checked }))} />
              <span>
                Calculate the totals automatically: each item = the sum of its rows, and each row = the sum of the same row in the sub-items.
                Untick to enter everything by hand. You can change any item afterwards with “Sum of sub-items?”.
              </span>
            </label>
            {split.error && <p className="text-red-600 dark:text-red-400">{split.error}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}
