// ============================================================
// SERVER ENTRYPOINT — Phase 8 (security hardening & polish)
// ============================================================
// Sets up Express with: CORS (allow-listed origins only), JSON
// body parsing, global + per-tenant rate limiting, versioned API
// routes (/api/v1/*), and a centralized error handler.
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import { validateEnv } from './config/env.js';
validateEnv(); // fail fast (prod) / warn (dev) before anything else runs

import { globalLimiter, tenantLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenants.js';
import teamRoutes from './routes/team.js';
import contactRoutes from './routes/contacts.js';
import dealRoutes from './routes/deals.js';
import analyticsRoutes from './routes/analytics.js';
import auditLogRoutes from './routes/auditLog.js';
import billingRoutes from './routes/billing.js';

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS: only allow approved frontend origins (per API rules) ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: '1mb' })); // limit payload size per API rules
app.use(globalLimiter);
app.use(tenantLimiter);

// --- Versioned API routes ---
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/deals', dealRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/audit-log', auditLogRoutes);
app.use('/api/v1/billing', billingRoutes);

// Placeholder so the frontend has something to hit beyond /health.
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'SaaS API v1 — Phase 8: security hardening & polish',
    routes: [
      '/api/v1/health',
      '/api/v1/health/db',
      'POST /api/v1/auth/signup',
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/refresh',
      'GET  /api/v1/auth/me',
      'POST /api/v1/auth/forgot-password',
      'POST /api/v1/auth/reset-password',
      'GET  /api/v1/tenants',
      'POST /api/v1/tenants',
      'DELETE /api/v1/tenants/current',
      'GET  /api/v1/contacts',
      'GET  /api/v1/deals',
      'GET  /api/v1/deals/kanban',
      'GET  /api/v1/analytics/overview',
      'GET  /api/v1/analytics/export?type=contacts|deals',
      'GET  /api/v1/audit-log',
      'GET  /api/v1/audit-log/actions',
      'GET  /api/v1/billing',
      'GET  /api/v1/billing/plans',
      'POST /api/v1/billing/change-plan',
    ],
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] Try: http://localhost:${PORT}/api/v1/health/db`);
});
