export const ROLES = Object.freeze({
  ADMIN: 'admin',
  ZONAL_DEPT_HEAD: 'zonal_dept_head',
  ZONAL_EXPERT: 'zonal_expert',
  ZONAL_PLAN_EXPERT: 'zonal_plan_expert',
  ZONAL_TEAM_LEADER: 'zonal_team_leader',
  WOREDA_DEPT_HEAD: 'woreda_dept_head',
  WOREDA_TEAM_LEADER: 'woreda_team_leader',
  WOREDA_EXPERT: 'woreda_expert',
  WOREDA_PLAN_EXPERT: 'woreda_plan_expert',
});

export const ALL_ROLES = Object.values(ROLES);
export const ZONAL_ROLES = [ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT, ROLES.ZONAL_TEAM_LEADER];
export const WOREDA_ROLES = [ROLES.WOREDA_DEPT_HEAD, ROLES.WOREDA_TEAM_LEADER, ROLES.WOREDA_EXPERT, ROLES.WOREDA_PLAN_EXPERT];
export const REVIEWER_ROLES = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT];
