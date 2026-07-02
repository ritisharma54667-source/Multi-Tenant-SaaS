// ============================================================
// RESET PASSWORD PAGE
// ============================================================
// Reached via the link in the forgot-password email:
// /reset-password?token=<raw token>. The token is sent to the
// backend on submit and never displayed or logged client-side.
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../api/auth.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      navigate('/login', { state: { resetSuccess: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2">Invalid link</h1>
          <p className="text-sm text-muted-text mb-4">
            This reset link is missing its token. Request a new one from the forgot
            password page.
          </p>
          <Link to="/forgot-password" className="text-sm text-brand hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <label className="block">
          <span className="text-sm text-muted-text">New password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted-text">Confirm new password</span>
          <input
            required
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
          />
        </label>

        <p className="text-xs text-muted-text">
          Must be at least 8 characters, with at least one letter and one number.
        </p>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
