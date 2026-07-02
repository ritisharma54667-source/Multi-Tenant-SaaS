// ============================================================
// FORGOT PASSWORD PAGE
// ============================================================
// Deliberately shows the SAME success message whether or not the
// email has an account — matches the backend's anti-enumeration
// behavior. Don't "improve" this by showing a different message
// for unknown emails; that would leak account existence.
// ============================================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>

        {submitted ? (
          <>
            <p className="text-sm text-muted-text mb-4">
              If an account exists for <span className="text-white">{email}</span>, we've
              sent a reset link — it expires in 30 minutes. Check your inbox (and the
              backend console, if you're running without SMTP configured).
            </p>
            <Link to="/login" className="text-sm text-brand hover:underline">
              Back to log in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-text mb-2">
              Enter your account email and we'll send you a link to reset your password.
            </p>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand transition-colors"
              />
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <p className="text-sm text-muted-text text-center">
              <Link to="/login" className="text-brand hover:underline">
                Back to log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
