import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import {
  flattenTree, newNode, updateNode, removeNode, insertNode, moveNode, indentNode, outdentNode, getNode, countDescendants, sumBlocker,
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
  const rows = flattenTree(nodes);

  const addRoot = () => setNodes((n) => [...n, newNode({ _focus: true })]);
  const addChild = (path) => setNodes((n) => insertNode(n, path, getNode(n, path).children.length, newNode({ _focus: true })));
  const addBelow = (path) => setNodes((n) => insertNode(n, path.slice(0, -1), path[path.length - 1] + 1, newNode({ _focus: true })));
  const remove = (path) => {
    const node = getNode(nodes, path);
    const kids = countDescendants(node);
    if (kids && !window.confirm(`Remove "${node.title || 'this item'}" and its ${kids} sub-item${kids === 1 ? '' : 's'}?`)) return;
    setNodes((n) => removeNode(n, path));
  };

  return (
    <Card title={`${title} (${rows.length})`} actions={!readOnly && <Button variant="secondary" onClick={addRoot}>Add item</Button>}>
      {!readOnly && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Lay the report out as it is on paper: items nest without limit (1. → 1.1. → 1.1.1. …). The <strong>measurement</strong> is the unit a value is
          reported in (e.g. %, Number, ETB). Leave it blank for a heading that has no value of its own. <strong>Is sum of sub-items?</strong> — choose Yes and the item's value is
          calculated automatically from its sub-items (they must use the same measurement; a percentage can't be a sum); choose No to enter it by hand.
          Press Enter in a title to add the next item.
        </p>
      )}
      {errors._tree && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{errors._tree}</p>}
      <datalist id="measurement-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>

      {!rows.length && <p className="text-sm text-slate-500 dark:text-slate-400">No items yet.</p>}

      <div className="space-y-1">
        {rows.map(({ node, path, code, depth }) => {
          const idx = path[path.length - 1];
          const blocker = node.measurement?.trim() ? sumBlocker(node) : 'a heading has no value of its own, so it cannot be a sum';
          const siblings = path.length === 1 ? nodes.length : getNode(nodes, path.slice(0, -1)).children.length;
          return (
            <div key={node._id} style={{ marginLeft: Math.min(depth, 8) * 20 }}>
              <div className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 ${node.measurement ? '' : 'bg-slate-50 dark:bg-slate-900/40'}`}>
                <span className="w-20 shrink-0 text-right font-mono text-xs text-slate-500 dark:text-slate-400" aria-label={`Item ${code}`}>{code}.</span>
                <input
                  className="input min-w-[12rem] flex-1" placeholder="Title" disabled={readOnly} autoFocus={!!node._focus}
                  value={node.title} aria-label={`Title of item ${code}`}
                  onChange={(e) => setNodes((n) => updateNode(n, path, { title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !readOnly) { e.preventDefault(); addBelow(path); } }}
                />
                <input
                  className="input w-44" placeholder="Measurement" list="measurement-suggestions" disabled={readOnly}
                  value={node.measurement} aria-label={`Measurement of item ${code}`}
                  onChange={(e) => setNodes((n) => updateNode(n, path, { measurement: e.target.value }))}
                />
                {node.measurement?.trim() && (readOnly ? (
                  node.sum_of_subitems && <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Sum of sub-items</span>
                ) : (
                  <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="whitespace-nowrap">Sum of sub-items?</span>
                    <select
                      className="input w-20 py-1" aria-label={`Is item ${code} the sum of its sub-items?`}
                      title={blocker && !node.sum_of_subitems ? `Not available: ${blocker}` : 'Yes: calculated from the sub-items. No: entered by hand.'}
                      value={node.sum_of_subitems ? 'yes' : 'no'}
                      onChange={(e) => setNodes((n) => updateNode(n, path, { sum_of_subitems: e.target.value === 'yes' }))}
                    >
                      <option value="no">No</option>
                      <option value="yes" disabled={!!blocker && !node.sum_of_subitems}>Yes</option>
                    </select>
                  </label>
                ))}
                {!readOnly && (
                  <div className="flex flex-wrap items-center">
                    <Act label="↑" title={`Move ${code} up`} disabled={idx === 0} onClick={() => setNodes((n) => moveNode(n, path, -1))} />
                    <Act label="↓" title={`Move ${code} down`} disabled={idx === siblings - 1} onClick={() => setNodes((n) => moveNode(n, path, 1))} />
                    <Act label="←" title={`Outdent ${code}`} disabled={path.length === 1} onClick={() => setNodes((n) => outdentNode(n, path))} />
                    <Act label="→" title={`Indent ${code}`} disabled={idx === 0} onClick={() => setNodes((n) => indentNode(n, path))} />
                    <Act label="+ Sub-item" title={`Add a sub-item under ${code}`} onClick={() => addChild(path)} />
                    <Act label="+ Below" title={`Add an item below ${code}`} onClick={() => addBelow(path)} />
                    <Act label="Remove" title={`Remove ${code}`} danger onClick={() => remove(path)} />
                  </div>
                )}
              </div>
              {!readOnly && node.sum_of_subitems && node.measurement?.trim() && blocker && !errors[code] && <p className="ml-24 text-xs text-amber-600 dark:text-amber-400">Cannot be a sum of its sub-items — {blocker}</p>}
              {errors[code] && <p className="ml-24 text-xs text-red-600 dark:text-red-400">{errors[code]}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
