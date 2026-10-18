import { ROLES, ZONAL_ROLES, WOREDA_ROLES } from '../constants/roles.js';

/** Zonal roles that belong to a specific team: they work only with their own team's templates and formats. */
const TEAM_SCOPED_ROLES = [ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER];

/**
 * What report templates / report formats a user may read or author, based on the
 * department (and, for experts and team leaders, the team) on their account.
 *
 *   { all: true }                  admin, and woreda roles (those are narrowed by what they ask for)
 *   null                           a zonal user with no department on their account: nothing
 *   { department_id, team_id? }    confined to that department — and to that team when the account has one
 *
 * An expert / team leader with a department but no team is confined to the department only.
 */
export function templateScope(user) {
  if (!ZONAL_ROLES.includes(user.role)) return { all: true };
  if (!user.department_id) return null;
  return {
    department_id: user.department_id,
    ...(TEAM_SCOPED_ROLES.includes(user.role) && user.team_id ? { team_id: user.team_id } : {}),
  };
}

/** Is a template or format (anything carrying department_id + team_id) inside the scope? */
export function inScope(scope, resource) {
  if (!scope) return false;
  if (scope.all) return true;
  if (resource.department_id !== scope.department_id) return false;
  if (scope.team_id && resource.team_id !== scope.team_id) return false;
  return true;
}

export const OUT_OF_SCOPE = 'This belongs to another department or team than the one on your account';

/** Woreda roles that belong to a specific team: they see only their own team's plans. */
const WOREDA_TEAM_SCOPED_ROLES = [ROLES.WOREDA_EXPERT, ROLES.WOREDA_TEAM_LEADER];

/**
 * Which cascaded plans a woreda user may see (within their own woreda), by the department — and, for
 * experts and team leaders, the team — on their account. Mirrors templateScope for zonal users.
 *   null                          a woreda user with no department on their account: nothing
 *   { department_id, team_id? }   confined to that department, and to that team when it applies
 */
export function woredaPlanScope(user) {
  if (!WOREDA_ROLES.includes(user.role)) return { all: true };
  if (!user.department_id) return null;
  return {
    department_id: user.department_id,
    ...(WOREDA_TEAM_SCOPED_ROLES.includes(user.role) && user.team_id ? { team_id: user.team_id } : {}),
  };
}
