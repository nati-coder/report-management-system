import api, { unwrap } from './api.js';
export const list = (params) => unwrap(api.get('/templates', { params }));
export const get = (id) => unwrap(api.get(`/templates/${id}`));
export const create = (body) => unwrap(api.post('/templates', body));
export const update = (id, body) => unwrap(api.put(`/templates/${id}`, body));
export const versions = (params) => unwrap(api.get('/templates/versions', { params }));
export const versionTree = (id, teamId) => unwrap(api.get(`/templates/versions/${id}`, { params: { team_id: teamId } }));
/** Zonal Plan Expert only: create a report_templates row for every team in the version's department. */
export const createForVersion = (body) => unwrap(api.post('/templates/for-version', body));
/** System Admin only: close a report version — no more templates or updates under it. */
export const closeVersion = (id) => unwrap(api.post(`/templates/versions/${id}/close`));
