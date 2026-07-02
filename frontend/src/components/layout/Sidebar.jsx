// ============================================================
// SIDEBAR
// ============================================================
// Navigation links. Items with a `permission` key are hidden
// entirely for roles that don't have it (e.g. Audit Log is
// admin/owner only) rather than shown and then blocked.
// ============================================================
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, UserRound, Kanban, ScrollText, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { usePermission } from '../../hooks/usePermission.js';

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/contacts',   icon: UserRound,        label: 'Contacts'   },
  { to: '/pipeline',   icon: Kanban,           label: 'Pipeline'   },
  { to: '/team',       icon: Users,            label: 'Team'       },
  { to: '/audit-log',  icon: ScrollText,       label: 'Audit Log', permission: 'view_audit_log' },
  { to: '/billing',    icon: CreditCard,       label: 'Billing'    },
  { to: '/settings',   icon: Settings,         label: 'Settings'   },
];

export default function Sidebar() {
  const { project } = useApp();
  const { can } = usePermission();

  const visibleNav = NAV.filter((item) => !item.permission || can(item.permission));

  return (
    <aside className="w-56 min-h-screen border-r border-white/5 bg-surface-dark flex flex-col py-6 px-3">
      <nav className="flex flex-col gap-1">
        {visibleNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand/15 text-brand font-medium'
                  : 'text-muted-text hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto text-xs text-muted-text px-3">
        v{project.phases.filter((p) => p.status === 'complete').length} phases complete
      </div>
    </aside>
  );
}
