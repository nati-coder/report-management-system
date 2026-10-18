import RoleDashboard from './RoleDashboard.jsx';

export default function PlanExpertDashboard() {
  return <RoleDashboard actions={[{ to: '/rankings/woredas', label: 'Woreda ranking matrix' }, { to: '/templates', label: 'Templates' }, { to: '/reports', label: 'Reports' }]} />;
}
