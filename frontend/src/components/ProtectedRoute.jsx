// ============================================================
// PROTECTED ROUTE
// ============================================================
// Redirects to /login if there's no authenticated session.
// Note: this is a UX convenience only — it does NOT grant access
// to any data. Every actual data request is independently
// verified by the backend (requireAuth + resolveTenantContext).
// ============================================================
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
