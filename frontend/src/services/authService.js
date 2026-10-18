import api, { unwrap } from './api.js';
export const login = (email, password) => unwrap(api.post('/auth/login', { email, password }));
export const me = () => unwrap(api.get('/auth/me'));
export const changePassword = (body) => unwrap(api.post('/auth/change-password', body));
export const notifications = () => unwrap(api.get('/auth/notifications'));
