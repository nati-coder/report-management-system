import api, { unwrap } from './api.js';
export const list = (params) => unwrap(api.get('/support-requests', { params }));
export const create = (body) => unwrap(api.post('/support-requests', body));
export const assign = (id, assigned_expert_id) => unwrap(api.patch(`/support-requests/${id}/assign`, { assigned_expert_id }));
export const setStatus = (id, status) => unwrap(api.patch(`/support-requests/${id}/status`, { status }));
export const feedback = (id, body) => unwrap(api.post(`/support-requests/${id}/feedback`, body));
