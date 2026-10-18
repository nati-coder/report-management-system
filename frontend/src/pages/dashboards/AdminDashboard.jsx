import RoleDashboard from './RoleDashboard.jsx';

export default function AdminDashboard() {
  return <RoleDashboard actions={[{ to: '/users', label: 'Manage users' }, { to: '/locations', label: 'Manage zones & woredas' }, { to: '/report-versions', label: 'Manage report versions' }, { to: '/templates', label: 'Report templates' }, { to: '/reports', label: 'All reports' }, { to: '/support', label: 'Support requests' }]} />;
}
