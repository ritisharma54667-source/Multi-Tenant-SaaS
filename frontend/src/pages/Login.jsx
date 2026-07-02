// ============================================================
// LOGIN PAGE
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../api/auth.js';
import { useAuthStore } from '../store/authStore.js';
import { useTenantStore } from '../store/tenantStore.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const setSession = useAuthStore((s) => s.setSession);
  const setMemberships = useTenantStore((s) => s.setMemberships);
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.resetSuccess) {
      toast.success('Password updated. Log in with your new password.');
    }
  }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form);
      setSession(data.user, data.accessToken, data.refreshToken);
      const memberships = data.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenantName,
        role: m.role,
        plan: m.plan,
      }));
      setMemberships(memberships);
      if (memberships.length > 0) {
        const first = memberships[0];
        setCurrentTenant(first.tenantId, first.tenantName, first.role, first.plan);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold mb-4">Log in</h1>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <label className="block">
          <span className="text-sm text-muted-text">Email</span>
          <input
            required
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted-text">Password</span>
          <input
            required
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
          />
        </label>

        <p className="text-sm text-right -mt-2">
          <Link to="/forgot-password" className="text-brand hover:underline">
            Forgot password?
          </Link>
        </p>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <p className="text-sm text-muted-text text-center">
          No account yet?{' '}
          <Link to="/signup" className="text-brand hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
