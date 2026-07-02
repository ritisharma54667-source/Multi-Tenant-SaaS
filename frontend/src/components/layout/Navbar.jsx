// ============================================================
// NAVBAR
// ============================================================
import { Moon, Sun, Building2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import WorkspaceSwitcher from './WorkspaceSwitcher.jsx';

export default function Navbar() {
  const { theme, toggleTheme, tenant, project, isAuthenticated, logout } = useApp();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-dark">
      <div className="flex items-center gap-2">
        <Building2 size={20} className="text-brand" />
        <span className="font-semibold">{project.name}</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-text">
        {isAuthenticated && tenant.name && <WorkspaceSwitcher />}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Log out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
