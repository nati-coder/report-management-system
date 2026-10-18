/** Shared helpers for the section / KPI editor used by the template and report-format builders. */
export const FIELD_TYPES = ['number', 'percentage', 'currency', 'date', 'boolean', 'text'];
/** KPI types that can carry a numeric target (and therefore be cascaded to woredas). */
export const NUMERIC_TYPES = ['number', 'percentage', 'currency'];

const uid = () => crypto.randomUUID();
export const slugify = (label) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const newField = () => ({ _id: uid(), key: '', keyTouched: false, label: '', type: 'number', unit: '', target: '', required: false, min: '', max: '' });
export const newSection = () => ({ _id: uid(), title: '', fields: [newField()] });

/** Strip client-only bookkeeping (_id, keyTouched) and coerce types before building the API payload. */
export function sectionsToSchema(sections) {
  return {
    sections: sections.map((s) => ({
      title: s.title,
      fields: s.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        ...(f.unit ? { unit: f.unit } : {}),
        ...(f.target !== '' && f.target !== null ? { target: Number(f.target) } : {}),
        required: !!f.required,
        ...(f.min !== '' && f.min !== null ? { min: Number(f.min) } : {}),
        ...(f.max !== '' && f.max !== null ? { max: Number(f.max) } : {}),
      })),
    })),
  };
}

/** Inverse of the above, for loading an existing schema into editable builder state. */
export function schemaToSections(schema) {
  const sections = schema?.sections?.length ? schema.sections : [{ title: '', fields: [{}] }];
  return sections.map((s) => ({
    _id: uid(),
    title: s.title || '',
    fields: (s.fields?.length ? s.fields : [{}]).map((f) => ({
      _id: uid(),
      key: f.key || '', keyTouched: true,
      label: f.label || '', type: f.type || 'number',
      unit: f.unit ?? '', target: f.target ?? '', required: !!f.required,
      min: f.min ?? '', max: f.max ?? '',
    })),
  }));
}

/** Returns an errors object keyed the way SchemaBuilderCard expects (empty object = valid). */
export function validateSections(sections) {
  const e = {};
  if (!sections.length) e.sections = 'At least one section is required';

  const allKeys = [];
  sections.forEach((s, si) => {
    if (!s.title.trim()) e[`section_${si}_title`] = 'Section title is required';
    if (!s.fields.length) e[`section_${si}_fields`] = 'Each section needs at least one KPI';
    s.fields.forEach((f, fi) => {
      const path = `s${si}f${fi}`;
      if (!f.label.trim()) e[`${path}_label`] = 'Label is required';
      if (!f.key) e[`${path}_key`] = 'Key could not be derived — check the label';
      else if (!/^[a-z0-9_]+$/.test(f.key)) e[`${path}_key`] = 'Key must be lowercase letters, numbers and underscores';
      if (f.key) allKeys.push(f.key);
      if (f.min !== '' && f.max !== '' && Number(f.min) > Number(f.max)) e[`${path}_min`] = 'Min cannot exceed max';
      if (['target', 'min', 'max'].some((k) => f[k] !== '' && Number.isNaN(Number(f[k])))) e[`${path}_num`] = 'Target/min/max must be numeric';
    });
  });
  const dupes = allKeys.filter((k, i) => allKeys.indexOf(k) !== i);
  if (dupes.length) e.duplicateKeys = `Duplicate KPI key(s): ${[...new Set(dupes)].join(', ')}`;
  return e;
}
