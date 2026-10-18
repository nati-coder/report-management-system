import RoleDashboard from './RoleDashboard.jsx';

export default function ZonalExpertDashboard() {
  return (
    <RoleDashboard actions={[
      { to: '/report-formats/new', label: 'New report format' },
      { to: '/report-formats', label: 'Report formats' },
      { to: '/plans/cascade', label: 'Cascade annual plan' },
      { to: '/reports', label: 'Woreda reports' },
      { to: '/reports/sheet', label: 'All woredas & summaries' },
      { to: '/rankings/teams', label: 'Score teams' },
      { to: '/support', label: 'My support tasks' },
    ]} />
  );
}
