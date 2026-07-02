// ============================================================
// CREATE NEW WORKSPACE — for an already-logged-in user spinning
// up an additional tenant (POST /api/v1/tenants).
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTenant } from '../api/auth.js';
import { useTenantStore } from '../store/tenantStore.js';

export default function CreateWorkspace() {
  const navigate = useNavigate();
  const memberships = useTenantStore((s) => s.memberships);
  const setMemberships = useTenantStore((s) => s.setMemberships);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tenant = await createTenant({ name });
      setMemberships([
        ...memberships,
        { tenantId: tenant.tenantId, tenantName: tenant.tenantName, role: tenant.role, plan: tenant.plan },
      ]);
      setCurrentTenant(tenant.tenantId, tenant.tenantName, tenant.role, tenant.plan);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create workspace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">New workspace</h1>
        {error && (
          <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <label className="block">
          <span className="text-sm text-muted-text">Organization name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
          />
        </label>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating...' : 'Create workspace'}
        </button>
      </form>
    </div>
  );
}
