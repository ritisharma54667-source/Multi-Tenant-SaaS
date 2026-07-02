// ============================================================
// PASSWORD RESET TOKEN UTILITIES
// ============================================================
// The raw token goes in the email link. Only its SHA-256 hash is
// stored in the database — same "never store the real secret"
// principle as bcrypt password hashing, just a faster hash since
// this one is a random 32-byte value already (nothing to brute
// force by trying common tokens, unlike passwords).
// ============================================================
import crypto from 'crypto';

const TOKEN_TTL_MINUTES = 30;

export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
