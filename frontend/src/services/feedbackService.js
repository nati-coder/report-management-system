import api, { unwrap } from './api.js';
/**
 * Written reviewer feedback (no scores). `kind` is one of:
 *   woreda_report      { report_id }                              — Zonal Expert / Team Leader
 *   woreda_plan        { format_id, woreda_id, year }             — Zonal Expert / Team Leader
 *   zone_plan          { format_id, year, zone_id? }              — Zonal Expert / Team Leader
 *   department_report  { year, period, department_id?, zone_id? } — Zonal Dept Head (period: 'm7' | 'q1' | 'h1' | 'annual' …)
 */
export const list = (params) => unwrap(api.get('/feedback', { params }));
export const add = (body) => unwrap(api.post('/feedback', body));
