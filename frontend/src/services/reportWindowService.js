import api, { unwrap } from './api.js';
/** Reporting periods: a month of a monthly report format opened for a zone's woredas between two times. */
export const list = (params) => unwrap(api.get('/report-windows', { params }));
export const get = (id) => unwrap(api.get(`/report-windows/${id}`)); // with every woreda's report status
export const create = (body) => unwrap(api.post('/report-windows', body));
export const update = (id, body) => unwrap(api.put(`/report-windows/${id}`, body));
export const remove = (id) => unwrap(api.delete(`/report-windows/${id}`));

// A PERIOD is one month for the zone (all teams together); a window above is one team's format of that month.
export const periodKey = (p) => `${p.zone_id}/${p.department_id}/${p.year}/${p.month}`;
export const periods = (params) => unwrap(api.get('/report-windows/periods', { params }));
export const period = (p) => unwrap(api.get(`/report-windows/periods/${periodKey(p)}`)); // with every woreda and its team reports
export const updatePeriod = (p, body) => unwrap(api.put(`/report-windows/periods/${periodKey(p)}`, body));
export const removePeriod = (p) => unwrap(api.delete(`/report-windows/periods/${periodKey(p)}`));
