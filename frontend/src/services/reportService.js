import api, { unwrap } from './api.js';
export const list = (params) => unwrap(api.get('/reports', { params }));
export const get = (id) => unwrap(api.get(`/reports/${id}`));
export const create = (body) => unwrap(api.post('/reports', body));
export const update = (id, body) => unwrap(api.put(`/reports/${id}`, body));
export const submit = (id) => unwrap(api.post(`/reports/${id}/submit`));
export const review = (id, body) => unwrap(api.post(`/reports/${id}/review`, body));
export const remove = (id) => unwrap(api.delete(`/reports/${id}`));
export const importExcel = (formData) => unwrap(api.post('/imports', formData));
/** Zone level users and the admin: every woreda's plan + report for one format and period, on one sheet. */
export const sheet = (params) => unwrap(api.get('/reports/sheet', { params }));
