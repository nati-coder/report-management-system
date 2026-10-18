import api, { unwrap } from './api.js';
/** Reporting periods: a month of a monthly report format opened for a zone's woredas between two times. */
export const list = (params) => unwrap(api.get('/report-windows', { params }));
export const get = (id) => unwrap(api.get(`/report-windows/${id}`)); // with every woreda's report status
export const create = (body) => unwrap(api.post('/report-windows', body));
export const update = (id, body) => unwrap(api.put(`/report-windows/${id}`, body));
export const remove = (id) => unwrap(api.delete(`/report-windows/${id}`));
