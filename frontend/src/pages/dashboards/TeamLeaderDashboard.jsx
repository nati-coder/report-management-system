import RoleDashboard from './RoleDashboard.jsx';

export default function TeamLeaderDashboard() {
  return <RoleDashboard actions={[{ to: '/reports/new', label: 'New report' }, { to: '/reports', label: 'Team reports' }, { to: '/rankings/teams', label: 'Team rankings' }]} />;
}
