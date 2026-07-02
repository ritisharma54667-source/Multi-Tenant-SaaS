// ============================================================
// DASHBOARD LAYOUT
// ============================================================
// Wraps all authenticated app pages: sidebar on the left,
// main content on the right.
// ============================================================
import Sidebar from './Sidebar.jsx';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
