// ============================================================
// SIGNUP PAGE — also doubles as org onboarding. One form creates
// the user AND their first workspace/tenant (owner role), per
// the brief's "create/select workspace" requirement.
// ============================================================
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '../api/auth.js';
import { useAuthStore } from '../store/authStore.js';
import { useTenantStore } from '../store/tenantStore.js';

export default function Signup() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setMemberships = useTenantStore((s) => s.setMemberships);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);

  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await signup(form);
      setSession(data.user, data.accessToken, data.refreshToken);
      setMemberships(data.memberships.map((m) => ({ tenantId: m.tenantId, tenantName: m.tenantName, role: m.role, plan: m.plan })));
      const first = data.memberships[0];
      setCurrentTenant(first.tenantId, first.tenantName, first.role, first.plan);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold mb-2">Create your workspace</h1>
        <p className="text-sm text-muted-text mb-4">
          One account, one workspace — invite your team after.
        </p>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Field label="Your name" name="name" value={form.name} onChange={handleChange} />
        <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
        <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} />
        <Field
          label="Organization name"
          name="organizationName"
          value={form.organizationName}
          onChange={handleChange}
        />

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating...' : 'Create workspace'}
        </button>

        <p className="text-sm text-muted-text text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, name, type = 'text', value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-text">{label}</span>
      <input
        required
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
      />
    </label>
  );
}
