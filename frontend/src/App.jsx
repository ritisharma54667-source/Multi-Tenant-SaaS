// ============================================================
// APP ROOT — Phase 8 + forgot/reset password
// ============================================================
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import Navbar from './components/layout/Navbar.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Contacts from './pages/Contacts.jsx';
import Pipeline from './pages/Pipeline.jsx';
import TeamMembers from './pages/TeamMembers.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Billing from './pages/Billing.jsx';
import Settings from './pages/Settings.jsx';
import CreateWorkspace from './pages/CreateWorkspace.jsx';
import NotFound from './pages/NotFound.jsx';

function AppPage({ children }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <Navbar />
            <Routes>
              <Route path="/"               element={<Landing />} />
              <Route path="/login"          element={<Login />} />
              <Route path="/signup"         element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />
              <Route path="/dashboard"      element={<AppPage><Dashboard /></AppPage>} />
              <Route path="/contacts"       element={<AppPage><Contacts /></AppPage>} />
              <Route path="/pipeline"       element={<AppPage><Pipeline /></AppPage>} />
              <Route path="/team"           element={<AppPage><TeamMembers /></AppPage>} />
              <Route path="/audit-log"      element={<AppPage><AuditLog /></AppPage>} />
              <Route path="/billing"        element={<AppPage><Billing /></AppPage>} />
              <Route path="/settings"       element={<AppPage><Settings /></AppPage>} />
              <Route path="/workspaces/new" element={<AppPage><CreateWorkspace /></AppPage>} />
              <Route path="*"               element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
