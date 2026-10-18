import RoleDashboard from './RoleDashboard.jsx';

export default function ZonalTeamLeaderDashboard() {
  return <RoleDashboard actions={[{ to: '/reports?status=submitted', label: 'Reports to review' }, { to: '/report-formats', label: 'Report formats' }, { to: '/reports/sheet', label: 'All woredas & summaries' }, { to: '/rankings/teams', label: 'Team rankings' }, { to: '/support', label: 'Support tasks' }]} />;
}
