// ============================================================
// CENTRALIZED ERROR HANDLER
// ============================================================
// Keeps error responses consistent and avoids leaking stack
// traces / internal details in production.
// ============================================================

export function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error.'
      : err.message || 'Something went wrong.';

  res.status(status).json({ error: message });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}
