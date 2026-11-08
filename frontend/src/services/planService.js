import api, { unwrap } from './api.js';
export const list = (params) => unwrap(api.get('/plans', { params }));
/** Zonal Expert: { format_id, year, submit, allocations: [{ woreda_id, data: { kpi_key: number } }] } */
export const cascade = (body) => unwrap(api.post('/plans/cascade', body));
/** Step 1: the zone plan for a format + year (null until saved). Admin passes zone_id; zonal users use their own zone. */
export const getZonePlan = (params) => unwrap(api.get('/plans/zone', { params }));
/** { format_id, year, data: { item_code: number }, zone_id? } — only saved when consistent. */
export const saveZonePlan = (body) => unwrap(api.put('/plans/zone', body));
/** Woreda Dept Head: { action: 'approve' | 'reject', rejection_reason? } — answer a plan cascaded to the woreda. */
export const review = (id, body) => unwrap(api.post(`/plans/${id}/review`, body));
/** Monthly plans (twelve rows per woreda) instead of annual ones: pass { period: 'monthly' } to list() — it returns annual plans by default. */
export const listMonthly = (params) => unwrap(api.get('/plans', { params: { ...params, period: 'monthly' } }));
/** Zonal Expert: { format_id, year, woreda_id, submit, months: [{ month: calendar number 1..12 (July = 7), data: { item_code: number } }] } */
export const saveMonthly = (body) => unwrap(api.post('/plans/monthly', body));
/** Zonal Expert: Excel file (Blob) of a plan table as shown on screen — see utils/planTable.js for the shape. */
export const exportTable = (table) => api.post('/plans/export', table, { responseType: 'blob' }).then((r) => r.data);
