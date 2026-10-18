import api, { unwrap } from './api.js';
export const teamRankings = (params) => unwrap(api.get('/rankings/teams', { params }));
export const scoreReport = (body) => unwrap(api.post('/rankings/teams/score', body));
export const computeTeams = (body) => unwrap(api.post('/rankings/teams/compute', body));
export const woredaRankings = (params) => unwrap(api.get('/rankings/woredas', { params }));
export const setWoredaRank = (body) => unwrap(api.post('/rankings/woredas', body));
