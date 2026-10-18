import RoleDashboard from './RoleDashboard.jsx';

export default function ZonalDeptHeadDashboard() {
  return <RoleDashboard actions={[{ to: '/reports?status=submitted', label: 'Review submissions' }, { to: '/support', label: 'Assign support requests' }, { to: '/report-versions', label: 'Report versions' }, { to: '/report-formats?status=pending_approval', label: 'Approve report formats' }]} />;
}
