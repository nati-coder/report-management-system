import RoleDashboard from './RoleDashboard.jsx';

export default function WoredaDeptHeadDashboard() {
  return <RoleDashboard actions={[{ to: '/plans', label: 'Annual plan' }, { to: '/reports/new', label: 'New report' }, { to: '/support/new', label: 'Request support' }, { to: '/rankings/teams', label: 'Team rankings' }]} />;
}
