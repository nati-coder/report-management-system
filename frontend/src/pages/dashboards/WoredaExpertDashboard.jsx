import RoleDashboard from './RoleDashboard.jsx';

export default function WoredaExpertDashboard() {
  return <RoleDashboard actions={[{ to: '/plans', label: 'Annual plan' }, { to: '/reports/new', label: 'New report' }, { to: '/reports', label: 'My reports' }]} />;
}
