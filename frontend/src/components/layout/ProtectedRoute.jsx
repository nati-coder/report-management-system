import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import Loader from '../common/Loader.jsx';
import { DASHBOARD_PATH } from '../../utils/roleHelpers.js';

/** RBAC route guard. <Route element={<ProtectedRoute roles={['admin']} />}>…</Route>  (admin always allowed) */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to={DASHBOARD_PATH[user.role] || '/login'} replace />;
  }
  return <Outlet />;
}
