import api, { unwrap } from './api.js';
export const list = (params) => unwrap(api.get('/users', { params }));
export const get = (id) => unwrap(api.get(`/users/${id}`));
export const create = (body) => unwrap(api.post('/users', body));
export const update = (id, body) => unwrap(api.patch(`/users/${id}`, body));
export const resetPassword = (id, newPassword) => unwrap(api.post(`/users/${id}/reset-password`, { newPassword }));
