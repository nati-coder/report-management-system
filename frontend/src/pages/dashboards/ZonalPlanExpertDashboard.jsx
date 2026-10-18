import RoleDashboard from './RoleDashboard.jsx';

export default function ZonalPlanExpertDashboard() {
  return <RoleDashboard actions={[{ to: '/reports/periods', label: 'Open reporting periods' }, { to: '/reports/sheet', label: 'All woredas & summaries' }, { to: '/rankings/woredas', label: 'Woreda ranking matrix' }, { to: '/templates', label: 'Report templates' }, { to: '/templates/new', label: 'New report template' }, { to: '/reports', label: 'Reports' }]} />;
}
