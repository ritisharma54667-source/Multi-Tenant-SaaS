// ============================================================
// WORKSPACE SWITCHER
// ============================================================
import { useState } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useTenantStore } from '../../store/tenantStore.js';
import { useNavigate } from 'react-router-dom';

export default function WorkspaceSwitcher() {
  const { tenant } = useApp();
  const switchTenant = useTenantStore((s) => s.switchTenant);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!tenant.id) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        {tenant.name}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-dark border border-white/10 rounded-lg shadow-xl py-1 z-10">
          {tenant.memberships.map((m) => (
            <button
              key={m.tenantId}
              onClick={() => {
                switchTenant(m.tenantId);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5 text-left"
            >
              <span>{m.tenantName}</span>
              {m.tenantId === tenant.id && <Check size={14} className="text-brand" />}
            </button>
          ))}
          <div className="border-t border-white/10 my-1" />
          <button
            onClick={() => {
              setOpen(false);
              navigate('/workspaces/new');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left text-brand"
          >
            <Plus size={14} /> New workspace
          </button>
        </div>
      )}
    </div>
  );
}
