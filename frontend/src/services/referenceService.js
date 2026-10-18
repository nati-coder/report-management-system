import api, { unwrap } from './api.js';
export const all = () => unwrap(api.get('/users/reference-data')); // { zones, woredas, departments, teams }

export const createZone = (body) => unwrap(api.post('/reference/zones', body));
export const updateZone = (zoneId, body) => unwrap(api.patch(`/reference/zones/${zoneId}`, body));
export const deleteZone = (zoneId) => unwrap(api.delete(`/reference/zones/${zoneId}`));

export const createWoreda = (body) => unwrap(api.post('/reference/woredas', body));
export const updateWoreda = (woredaId, body) => unwrap(api.patch(`/reference/woredas/${woredaId}`, body));
export const deleteWoreda = (woredaId) => unwrap(api.delete(`/reference/woredas/${woredaId}`));

export const createDepartment = (body) => unwrap(api.post('/reference/departments', body));
export const updateDepartment = (id, body) => unwrap(api.patch(`/reference/departments/${id}`, body));
export const deleteDepartment = (id) => unwrap(api.delete(`/reference/departments/${id}`));

export const createTeam = (body) => unwrap(api.post('/reference/teams', body));
export const updateTeam = (id, body) => unwrap(api.patch(`/reference/teams/${id}`, body));
export const deleteTeam = (id) => unwrap(api.delete(`/reference/teams/${id}`));
