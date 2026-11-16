import api, { unwrap } from './api.js';

/**
 * Achievement ranking (read-only). params = { year, period, month?, zone_id?, department_id?, team_id?, cap? }
 * zone_id / department_id are only needed (and only accepted) for the admin.
 */
export const woredaRank = (params) => unwrap(api.get('/rank/woredas', { params })); // + mode: 'overall' | 'team'
export const teamRank = (params) => unwrap(api.get('/rank/teams', { params }));
