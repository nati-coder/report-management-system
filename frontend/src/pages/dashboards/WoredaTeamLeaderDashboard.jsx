import RoleDashboard from './RoleDashboard.jsx';

export default function WoredaTeamLeaderDashboard() {
  return <RoleDashboard actions={[{ to: '/plans', label: 'Annual plan' }, { to: '/reports/new', label: 'New report' }, { to: '/reports', label: 'Team reports' }, { to: '/rankings/teams', label: 'Team rankings' }]} />;
}
