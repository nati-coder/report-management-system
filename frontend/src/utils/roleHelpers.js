export const ROLES = {
  ADMIN: 'admin',
  ZONAL_DEPT_HEAD: 'zonal_dept_head',
  ZONAL_EXPERT: 'zonal_expert',
  ZONAL_PLAN_EXPERT: 'zonal_plan_expert',
  ZONAL_TEAM_LEADER: 'zonal_team_leader',
  WOREDA_DEPT_HEAD: 'woreda_dept_head',
  WOREDA_TEAM_LEADER: 'woreda_team_leader',
  WOREDA_EXPERT: 'woreda_expert',
  WOREDA_PLAN_EXPERT: 'woreda_plan_expert',
};

export const ZONAL_ROLES = [ROLES.ZONAL_DEPT_HEAD, ROLES.ZONAL_EXPERT, ROLES.ZONAL_PLAN_EXPERT, ROLES.ZONAL_TEAM_LEADER];
export const WOREDA_ROLES = [ROLES.WOREDA_DEPT_HEAD, ROLES.WOREDA_TEAM_LEADER, ROLES.WOREDA_EXPERT, ROLES.WOREDA_PLAN_EXPERT];

/** Roles that belong to a team: choosing one is mandatory when the account is created. */
export const TEAM_REQUIRED_ROLES = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.WOREDA_EXPERT, ROLES.WOREDA_TEAM_LEADER];
/** Department-level and plan-level roles (zonal and woreda): no team. Mirrors backend/src/utils/userRules.js. */
export const TEAMLESS_ROLES = [ROLES.ZONAL_DEPT_HEAD, ROLES.WOREDA_DEPT_HEAD, ROLES.ZONAL_PLAN_EXPERT, ROLES.WOREDA_PLAN_EXPERT];

export const hasRole = (user, ...roles) => !!user && (user.role === ROLES.ADMIN || roles.includes(user.role));
export const isWoredaUser = (u) => WOREDA_ROLES.includes(u?.role);
export const isZonalUser = (u) => ZONAL_ROLES.includes(u?.role);

export const DASHBOARD_PATH = {
  [ROLES.ADMIN]: '/dashboard/admin',
  [ROLES.ZONAL_DEPT_HEAD]: '/dashboard/zonal-head',
  [ROLES.ZONAL_EXPERT]: '/dashboard/zonal-expert',
  [ROLES.ZONAL_PLAN_EXPERT]: '/dashboard/zonal-plan-expert',
  [ROLES.ZONAL_TEAM_LEADER]: '/dashboard/zonal-team-leader',
  [ROLES.WOREDA_DEPT_HEAD]: '/dashboard/woreda-head',
  [ROLES.WOREDA_TEAM_LEADER]: '/dashboard/woreda-team-leader',
  [ROLES.WOREDA_EXPERT]: '/dashboard/woreda-expert',
  [ROLES.WOREDA_PLAN_EXPERT]: '/dashboard/woreda-plan-expert',
};

export const ROLE_LABEL = {
  [ROLES.ADMIN]: { en: 'Admin', am: 'አስተዳዳሪ' },
  [ROLES.ZONAL_DEPT_HEAD]: { en: 'Zonal Department Head', am: 'የዞን ዘርፍ ኃላፊ' },
  [ROLES.ZONAL_EXPERT]: { en: 'Zonal Expert', am: 'የዞን ባለሙያ' },
  [ROLES.ZONAL_PLAN_EXPERT]: { en: 'Zonal Plan Expert', am: 'የዞን የእቅድ ባለሙያ' },
  [ROLES.ZONAL_TEAM_LEADER]: { en: 'Zonal Team Leader', am: 'የዞን ቡድን መሪ' },
  [ROLES.WOREDA_DEPT_HEAD]: { en: 'Woreda Department Head', am: 'የወረዳ ዘርፍ ኃላፊ' },
  [ROLES.WOREDA_TEAM_LEADER]: { en: 'Woreda Team Leader', am: 'የወረዳ ቡድን መሪ' },
  [ROLES.WOREDA_EXPERT]: { en: 'Woreda Expert', am: 'የወረዳ ባለሙያ' },
  [ROLES.WOREDA_PLAN_EXPERT]: { en: 'Woreda Plan Expert', am: 'የወረዳ የእቅድ ባለሙያ' },
};
