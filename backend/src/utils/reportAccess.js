import ReportFormat from '../models/ReportFormat.js';
import { ApiError } from './apiResponse.js';
import { ROLES, WOREDA_ROLES, ZONAL_ROLES } from '../constants/roles.js';
import { WOREDA_ONLY } from '../constants/status.js';
import { canAccessWoreda } from '../middlewares/rbacMiddleware.js';
import { templateScope, woredaPlanScope, inScope, OUT_OF_SCOPE } from './scope.js';

/**
 * The single rule for "may this user see / act on this report?", used by every report and scoring endpoint:
 *   1. the report's woreda is in the user's administrative scope (admin: any; zonal: their zone; woreda: their own);
 *   2. the zone never sees what is still inside the woreda (draft / waiting for the woreda plan expert);
 *   3. for a report filed against a report format, the format's department (and team, for experts and team
 *      leaders) must be the one on the user's account — in the zone as well as in the woreda.
 * Reports with no format (legacy) have nothing to scope by beyond rule 1 and 2.
 * Returns the report's format (or null) so callers do not have to load it again.
 */
export async function assertReportAccess(user, report) {
  if (!(await canAccessWoreda(user, report.woreda_id))) throw ApiError.forbidden('Outside your administrative scope');
  if (ZONAL_ROLES.includes(user.role) && WOREDA_ONLY.includes(report.status)) throw ApiError.notFound('Report not found');
  const format = report.format_id ? await ReportFormat.findById(report.format_id) : null;
  if (format && user.role !== ROLES.ADMIN) {
    const scope = WOREDA_ROLES.includes(user.role) ? woredaPlanScope(user) : templateScope(user);
    if (!inScope(scope, format)) throw ApiError.forbidden(OUT_OF_SCOPE);
  }
  return format;
}

export { canManageReport } from './scope.js';
