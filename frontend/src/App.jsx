import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import useAuth from './hooks/useAuth.js';
import { DASHBOARD_PATH, ROLES, WOREDA_ROLES, ZONAL_ROLES } from './utils/roleHelpers.js';

import LoginPage from './pages/auth/LoginPage.jsx';
import AdminDashboard from './pages/dashboards/AdminDashboard.jsx';
import ZonalDeptHeadDashboard from './pages/dashboards/ZonalDeptHeadDashboard.jsx';
import ZonalExpertDashboard from './pages/dashboards/ZonalExpertDashboard.jsx';
import ZonalPlanExpertDashboard from './pages/dashboards/ZonalPlanExpertDashboard.jsx';
import ZonalTeamLeaderDashboard from './pages/dashboards/ZonalTeamLeaderDashboard.jsx';
import WoredaDeptHeadDashboard from './pages/dashboards/WoredaDeptHeadDashboard.jsx';
import WoredaTeamLeaderDashboard from './pages/dashboards/WoredaTeamLeaderDashboard.jsx';
import WoredaExpertDashboard from './pages/dashboards/WoredaExpertDashboard.jsx';
import WoredaPlanExpertDashboard from './pages/dashboards/WoredaPlanExpertDashboard.jsx';
import TemplateListPage from './pages/templates/TemplateListPage.jsx';
import ReportVersionsPage from './pages/templates/ReportVersionsPage.jsx';
import FormatListPage from './pages/formats/FormatListPage.jsx';
import FormatBuilderPage from './pages/formats/FormatBuilderPage.jsx';
import PlanPage from './pages/plans/PlanPage.jsx';
import MyPlansPage from './pages/plans/MyPlansPage.jsx';
import TemplateBuilderPage from './pages/templates/TemplateBuilderPage.jsx';
import ReportListPage from './pages/reports/ReportListPage.jsx';
import CreateReportPage from './pages/reports/CreateReportPage.jsx';
import ReportDetailsPage from './pages/reports/ReportDetailsPage.jsx';
import ReportSheetPage from './pages/reports/ReportSheetPage.jsx';
import ReportPeriodsPage from './pages/reports/ReportPeriodsPage.jsx';
import TeamRankingsPage from './pages/rankings/TeamRankingsPage.jsx';
import WoredaRankingsPage from './pages/rankings/WoredaRankingsPage.jsx';
import UserListPage from './pages/users/UserListPage.jsx';
import LocationsPage from './pages/admin/LocationsPage.jsx';
import SupportListPage from './pages/support/SupportListPage.jsx';
import CreateSupportPage from './pages/support/CreateSupportPage.jsx';

const {
  ZONAL_DEPT_HEAD, ZONAL_EXPERT, ZONAL_PLAN_EXPERT, ZONAL_TEAM_LEADER,
  WOREDA_DEPT_HEAD, WOREDA_TEAM_LEADER, WOREDA_EXPERT, WOREDA_PLAN_EXPERT,
} = ROLES;

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? DASHBOARD_PATH[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />

          <Route element={<ProtectedRoute roles={[]} />}><Route path="/dashboard/admin" element={<AdminDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[ZONAL_DEPT_HEAD]} />}><Route path="/dashboard/zonal-head" element={<ZonalDeptHeadDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[ZONAL_EXPERT]} />}><Route path="/dashboard/zonal-expert" element={<ZonalExpertDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[ZONAL_PLAN_EXPERT]} />}><Route path="/dashboard/zonal-plan-expert" element={<ZonalPlanExpertDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[ZONAL_TEAM_LEADER]} />}><Route path="/dashboard/zonal-team-leader" element={<ZonalTeamLeaderDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[WOREDA_DEPT_HEAD]} />}><Route path="/dashboard/woreda-head" element={<WoredaDeptHeadDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[WOREDA_TEAM_LEADER]} />}><Route path="/dashboard/woreda-team-leader" element={<WoredaTeamLeaderDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[WOREDA_EXPERT]} />}><Route path="/dashboard/woreda-expert" element={<WoredaExpertDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={[WOREDA_PLAN_EXPERT]} />}><Route path="/dashboard/woreda-plan-expert" element={<WoredaPlanExpertDashboard />} /></Route>

          {/* Report versions: Admin creates, Zonal Dept Head creates/approves */}
          <Route element={<ProtectedRoute roles={[ZONAL_DEPT_HEAD]} />}>
            <Route path="/report-versions" element={<ReportVersionsPage />} />
          </Route>
          {/* Report templates: Zonal Plan Expert lists, creates (choosing the version) and edits them */}
          <Route element={<ProtectedRoute roles={[ZONAL_PLAN_EXPERT]} />}>
            <Route path="/templates" element={<TemplateListPage />} />
            <Route path="/templates/new" element={<TemplateBuilderPage />} />
            <Route path="/templates/:id" element={<TemplateBuilderPage />} />
          </Route>

          {/* Report formats: Zonal Expert / Team Leader author them, Zonal Dept Head approves */}
          <Route element={<ProtectedRoute roles={[ZONAL_EXPERT, ZONAL_TEAM_LEADER, ZONAL_DEPT_HEAD]} />}>
            <Route path="/report-formats" element={<FormatListPage />} />
            <Route path="/report-formats/:id" element={<FormatBuilderPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={[ZONAL_EXPERT, ZONAL_TEAM_LEADER]} />}>
            <Route path="/report-formats/new" element={<FormatBuilderPage />} />
          </Route>
          {/* Plan (Annual Plan + Monthly Plan tabs): Zonal Expert */}
          <Route element={<ProtectedRoute roles={[ZONAL_EXPERT]} />}>
            <Route path="/plans/cascade" element={<PlanPage />} />
          </Route>
          {/* Annual plan received from the zone: woreda users read it, the Dept Head accepts or rejects it */}
          <Route element={<ProtectedRoute roles={WOREDA_ROLES} />}>
            <Route path="/plans" element={<MyPlansPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={[]} />}>
            <Route path="/users" element={<UserListPage />} />
            <Route path="/locations" element={<LocationsPage />} />
          </Route>

          <Route path="/reports" element={<ReportListPage />} />
          <Route element={<ProtectedRoute roles={WOREDA_ROLES} />}>
            <Route path="/reports/new" element={<CreateReportPage />} />
          </Route>
          {/* All woredas' reports on one sheet (+ quarterly / half-year / annual summaries) and the reporting periods: zone level users and the admin */}
          <Route element={<ProtectedRoute roles={ZONAL_ROLES} />}>
            <Route path="/reports/sheet" element={<ReportSheetPage />} />
            <Route path="/reports/periods" element={<ReportPeriodsPage />} />
          </Route>
          <Route path="/reports/:id" element={<ReportDetailsPage />} />

          <Route path="/rankings/teams" element={<TeamRankingsPage />} />
          <Route path="/rankings/woredas" element={<WoredaRankingsPage />} />

          <Route path="/support" element={<SupportListPage />} />
          <Route element={<ProtectedRoute roles={[WOREDA_DEPT_HEAD]} />}><Route path="/support/new" element={<CreateSupportPage />} /></Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
