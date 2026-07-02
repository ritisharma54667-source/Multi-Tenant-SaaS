// ============================================================
// SETTINGS PAGE — Phase 8
// ============================================================
// Finally gives the "/settings" link in the sidebar (present
// since Phase 1) somewhere to go — it was a dead link until now.
//
// Three sections: profile (read-only, no edit-profile endpoint
// exists yet — noted as a gap in the README), workspace info, and
// a danger zone for deleting the workspace. Delete is gated behind
// delete_workspace (owner-only) — the last unused permission from
// the Phase 3 table now has a home.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Building2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useTenantStore } from '../store/tenantStore.js';
import { deleteWorkspace } from '../api/tenants.js';
import { useToast } from '../context/ToastContext.jsx';
import PermissionGate from '../components/PermissionGate.jsx';

export default function Settings() {
  const { user, tenant } = useApp();
  const { memberships, switchTenant, clearTenant } = useTenantStore();
  const toast = useToast();
  const navigate = useNavigate();

  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    setDeleting(true);
    try {
      await deleteWorkspace(confirmName);
      toast.success('Workspace deleted.');

      const remaining = memberships.filter((m) => m.tenantId !== tenant.id);
      if (remaining.length > 0) {
        switchTenant(remaining[0].tenantId);
        navigate('/dashboard');
      } else {
        clearTenant();
        navigate('/workspaces/new');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete workspace.');
    } finally {
      setDeleting(false);
      setShowConfirm(false);
      setConfirmName('');
    }
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <SettingsIcon size={22} className="text-brand" /> Settings
        </h1>
      </div>

      {/* Profile */}
      <div className="card">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
          <User size={15} className="text-muted-text" /> Profile
        </h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-text">Name</span>
            <span>{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Email</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="card">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Building2 size={15} className="text-muted-text" /> Workspace
        </h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-text">Name</span>
            <span>{tenant.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Your role</span>
            <span className="capitalize">{tenant.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Plan</span>
            <span className="capitalize">{tenant.plan}</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <PermissionGate permission="delete_workspace">
        <div className="card border-status-error/30">
          <h2 className="text-sm font-medium mb-2 flex items-center gap-2 text-status-error">
            <AlertTriangle size={15} /> Danger zone
          </h2>
          <p className="text-xs text-muted-text mb-4">
            Permanently deletes "{tenant.name}" and everything in it — contacts, deals,
            team members, and audit history. This cannot be undone.
          </p>

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm text-status-error border border-status-error/40 rounded-lg px-4 py-2 hover:bg-status-error/10 transition-colors"
            >
              Delete this workspace
            </button>
          ) : (
            <form onSubmit={handleDelete} className="flex flex-col gap-2">
              <label className="text-xs text-muted-text">
                Type <span className="font-medium text-white">{tenant.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-status-error"
                autoFocus
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={deleting || confirmName !== tenant.name}
                  className="text-sm bg-status-error hover:bg-status-error/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Permanently delete'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); setConfirmName(''); }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </PermissionGate>
    </div>
  );
}
