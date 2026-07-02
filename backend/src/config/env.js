// ============================================================
// ENV VALIDATION — Phase 8
// ============================================================
// Runs once at boot, before the Express app is even constructed.
// Two modes:
//   - production: HARD FAILS (process.exit(1)) if a required var
//     is missing, or if a JWT secret is still the placeholder
//     value from .env.example. Better to refuse to start than to
//     silently sign tokens with a secret anyone can find on GitHub.
//   - development: WARNS to console but still boots, so local dev
//     with the example secrets keeps working out of the box.
// ============================================================

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const PLACEHOLDER_SECRETS = new Set([
  'dev_access_secret_change_me',
  'dev_refresh_secret_change_me',
  '',
  undefined,
]);

const MIN_SECRET_LENGTH = 16;

export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const problems = [];

  for (const name of REQUIRED_VARS) {
    if (!process.env[name]) {
      problems.push(`${name} is not set.`);
    }
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[name];
    if (PLACEHOLDER_SECRETS.has(value)) {
      problems.push(`${name} is still using the .env.example placeholder value.`);
    } else if (value && value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters — use a longer random string.`);
    }
  }

  if (problems.length === 0) return;

  const header = isProd
    ? '[env] FATAL — refusing to start in production with unsafe config:'
    : '[env] WARNING — using dev-only config (fine locally, do NOT deploy like this):';

  console.error(header);
  problems.forEach((p) => console.error(`  - ${p}`));

  if (isProd) {
    console.error('[env] Set real values in your environment and restart.');
    process.exit(1);
  }
}
