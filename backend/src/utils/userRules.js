/**
 * Placement rules for a user account (who needs a zone / woreda / department / team).
 * Pure functions, so the controller and the tests share one definition. The frontend form mirrors them
 * (frontend/src/utils/roleHelpers.js).
 *
 *   zone        every role except admin; a zonal role never has a woreda, a woreda role needs one
 *   department  mandatory for every role except admin
 *   team        mandatory for experts and team leaders; never set for the department heads and the plan
 *               experts (zonal and woreda alike) — they work across the department's teams, so a team is dropped
 */
import { ROLES, WOREDA_ROLES, ZONAL_ROLES } from '../constants/roles.js';
import { ApiError } from './apiResponse.js';

/** Roles that belong to a team: choosing one is mandatory. */
export const TEAM_REQUIRED_ROLES = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.WOREDA_EXPERT, ROLES.WOREDA_TEAM_LEADER];
/** Department-level and plan-level roles (zonal and woreda): no team. */
export const TEAMLESS_ROLES = [ROLES.ZONAL_DEPT_HEAD, ROLES.WOREDA_DEPT_HEAD, ROLES.ZONAL_PLAN_EXPERT, ROLES.WOREDA_PLAN_EXPERT];

/** Does this role need a department? (everyone but the system admin) */
export const needsDepartment = (role) => role !== ROLES.ADMIN;

/** The user with the team rule applied: a team-less role never keeps a team_id. */
export const withTeamRule = (u) => (TEAMLESS_ROLES.includes(u.role) ? { ...u, team_id: null } : u);

/** Throws a 400 when the user (as it would be saved) breaks a placement rule. */
export function checkPlacement(u) {
  if (WOREDA_ROLES.includes(u.role) && !u.woreda_id) throw ApiError.badRequest('woreda_id is required for woreda-level roles');
  if (ZONAL_ROLES.includes(u.role) && !u.zone_id) throw ApiError.badRequest('zone_id is required for zonal-level roles');
  if (ZONAL_ROLES.includes(u.role) && u.woreda_id) throw ApiError.badRequest('A zonal role cannot be assigned to a woreda');
  if (needsDepartment(u.role) && !u.department_id) throw ApiError.badRequest('A department is required for this role');
  if (TEAM_REQUIRED_ROLES.includes(u.role) && !u.team_id) throw ApiError.badRequest('A team is required for this role');
}
