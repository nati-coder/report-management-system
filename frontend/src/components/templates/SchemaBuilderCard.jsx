import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import { FIELD_TYPES, newField, newSection, slugify } from '../../utils/schemaBuilder.js';

/**
 * Section / KPI editor. Controlled: pass `sections` + `setSections` from the
 * parent, and `errors` from validateSections(). `readOnly` shows the same
 * layout with every control disabled (used when viewing a locked format).
 */
export default function SchemaBuilderCard({ sections, setSections, errors = {}, readOnly = false, title = 'Sections & KPIs' }) {
  const addSection = () => setSections((s) => [...s, newSection()]);
  const removeSection = (sid) => setSections((s) => s.filter((x) => x._id !== sid));
  const setSectionTitle = (sid, t) => setSections((s) => s.map((x) => (x._id === sid ? { ...x, title: t } : x)));
  const addField = (sid) => setSections((s) => s.map((x) => (x._id === sid ? { ...x, fields: [...x.fields, newField()] } : x)));
  const removeField = (sid, fid) => setSections((s) => s.map((x) => (x._id === sid ? { ...x, fields: x.fields.filter((f) => f._id !== fid) } : x)));
  const setField = (sid, fid, patch) => setSections((s) => s.map((x) => (x._id !== sid ? x : {
    ...x,
    fields: x.fields.map((f) => {
      if (f._id !== fid) return f;
      const next = { ...f, ...patch };
      if ('label' in patch && !f.keyTouched) next.key = slugify(patch.label); // key follows the label until edited by hand
      return next;
    }),
  })));
  const setFieldKey = (sid, fid, key) => setField(sid, fid, { key, keyTouched: true });

  const err = 'mt-1 text-xs text-red-600 dark:text-red-400';

  return (
    <Card title={title} actions={!readOnly && <Button variant="secondary" onClick={addSection}>Add section</Button>}>
      {errors.sections && <p className={`mb-2 ${err}`}>{errors.sections}</p>}
      {errors.duplicateKeys && <p className={`mb-2 ${err}`}>{errors.duplicateKeys}</p>}
      <div className="space-y-5">
        {sections.map((s, si) => (
          <fieldset key={s._id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-600">
            <div className="mb-3 flex items-center gap-2">
              <input className="input" placeholder="Section title" disabled={readOnly} value={s.title} onChange={(e) => setSectionTitle(s._id, e.target.value)} />
              {!readOnly && sections.length > 1 && <Button variant="danger" onClick={() => removeSection(s._id)}>Remove section</Button>}
            </div>
            {errors[`section_${si}_title`] && <p className={`mb-2 ${err}`}>{errors[`section_${si}_title`]}</p>}

            <div className="space-y-3">
              {s.fields.map((f, fi) => (
                <div key={f._id} className="rounded-md bg-slate-50 p-3 dark:bg-slate-900/40">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <label className="label">Label</label>
                      <input className="input" disabled={readOnly} value={f.label} onChange={(e) => setField(s._id, f._id, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Key</label>
                      <input className="input font-mono text-xs" disabled={readOnly} value={f.key} onChange={(e) => setFieldKey(s._id, f._id, e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Type</label>
                      <select className="input" disabled={readOnly} value={f.type} onChange={(e) => setField(s._id, f._id, { type: e.target.value })}>
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Unit</label>
                      <input className="input" disabled={readOnly} value={f.unit} onChange={(e) => setField(s._id, f._id, { unit: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Target</label>
                      <input type="number" className="input" disabled={readOnly} value={f.target} onChange={(e) => setField(s._id, f._id, { target: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
                    <div>
                      <label className="label">Min</label>
                      <input type="number" className="input" disabled={readOnly} value={f.min} onChange={(e) => setField(s._id, f._id, { min: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Max</label>
                      <input type="number" className="input" disabled={readOnly} value={f.max} onChange={(e) => setField(s._id, f._id, { max: e.target.value })} />
                    </div>
                    <label className="mt-6 flex items-center gap-2 text-sm">
                      <input type="checkbox" disabled={readOnly} checked={f.required} onChange={(e) => setField(s._id, f._id, { required: e.target.checked })} />
                      Required
                    </label>
                    <div className="flex items-end md:col-span-3 md:justify-end">
                      {!readOnly && s.fields.length > 1 && <Button variant="danger" onClick={() => removeField(s._id, f._id)}>Remove KPI</Button>}
                    </div>
                  </div>
                  {(errors[`s${si}f${fi}_label`] || errors[`s${si}f${fi}_key`] || errors[`s${si}f${fi}_min`] || errors[`s${si}f${fi}_num`]) && (
                    <p className={err}>{errors[`s${si}f${fi}_label`] || errors[`s${si}f${fi}_key`] || errors[`s${si}f${fi}_min`] || errors[`s${si}f${fi}_num`]}</p>
                  )}
                </div>
              ))}
            </div>
            {errors[`section_${si}_fields`] && <p className={`mt-2 ${err}`}>{errors[`section_${si}_fields`]}</p>}
            {!readOnly && <Button variant="secondary" className="mt-3" onClick={() => addField(s._id)}>Add KPI</Button>}
          </fieldset>
        ))}
      </div>
    </Card>
  );
}
