import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import { DASHBOARD_PATH, ROLES, isWoredaUser } from '../../utils/roleHelpers.js';
import { t } from '../../utils/formatters.js';

export default function Sidebar() {
  const { user } = useAuth();
  const canVersions = [ROLES.ADMIN, ROLES.ZONAL_DEPT_HEAD].includes(user.role);
  const canFormats = [ROLES.ADMIN, ROLES.ZONAL_EXPERT, ROLES.ZONAL_TEAM_LEADER, ROLES.ZONAL_DEPT_HEAD].includes(user.role);
  const canPlans = [ROLES.ADMIN, ROLES.ZONAL_EXPERT].includes(user.role);
  const canTemplates = [ROLES.ADMIN, ROLES.ZONAL_PLAN_EXPERT].includes(user.role);
  const canManageUsers = user.role === ROLES.ADMIN;
  const items = [
    { to: DASHBOARD_PATH[user.role], label: t('dashboard') },
    { to: '/reports', label: t('reports') },
    ...(canManageUsers ? [{ to: '/users', label: 'Users' }, { to: '/locations', label: 'Zones & Woredas' }] : []),
    ...(canVersions ? [{ to: '/report-versions', label: 'Report Versions' }] : []),
    ...(canTemplates ? [{ to: '/templates', label: 'Report Templates' }] : []),
    ...(canFormats ? [{ to: '/report-formats', label: 'Report Formats' }] : []),
    ...(canPlans ? [{ to: '/plans/cascade', label: 'Plan' }] : []),
    ...(isWoredaUser(user) ? [{ to: '/plans', label: 'Annual Plans' }] : []),
    { to: '/rankings/teams', label: `${t('rankings')} · Teams` },
    { to: '/rankings/woredas', label: `${t('rankings')} · Woredas` },
    { to: '/support', label: t('support') },
  ];
  return (
    <nav className="print:hidden w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to}
          className={({ isActive }) => `mb-1 block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}
