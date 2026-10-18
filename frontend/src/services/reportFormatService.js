import api, { unwrap } from './api.js';
export const list = (params) => unwrap(api.get('/report-formats', { params }));
export const get = (id) => unwrap(api.get(`/report-formats/${id}`));
export const create = (body) => unwrap(api.post('/report-formats', body));
export const update = (id, body) => unwrap(api.put(`/report-formats/${id}`, body));
export const submit = (id) => unwrap(api.post(`/report-formats/${id}/submit`));
/** Zonal Dept Head: { action: 'approve' | 'reject', rejection_reason? } */
export const review = (id, body) => unwrap(api.post(`/report-formats/${id}/review`, body));
/** Approved formats only. type: 'xlsx' | 'csv'. Resolves to a Blob. */
export const exportFile = (id, type) => api.get(`/report-formats/${id}/export`, { params: { type }, responseType: 'blob' }).then((r) => r.data);
