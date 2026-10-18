import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('rms_token');
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

/** Unwrap the { success, data } envelope */
export const unwrap = (p) => p.then((r) => r.data.data);
export const errorMessage = (e) => {
  const d = e.response?.data;
  // validation failures carry per-field reasons — show the first one, not just "Validation failed"
  const first = d?.details && typeof d.details === 'object' ? Object.values(d.details).flat().find((x) => typeof x === 'string') : null;
  if (d?.message) return first ? `${d.message}: ${first}` : d.message;
  return e.message || 'Something went wrong';
};

export default api;
