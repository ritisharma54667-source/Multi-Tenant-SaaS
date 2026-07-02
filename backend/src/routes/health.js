// ============================================================
// HEALTH / STATUS ROUTES
// ============================================================
// /api/v1/health        — basic liveness check
// /api/v1/health/db     — confirms DB connectivity (useful for
//                          verifying your DATABASE_URL is correct
//                          right after Phase 1 setup)
// ============================================================

import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'saas-backend', phase: 1 });
});

router.get('/db', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as time');
    res.json({ status: 'ok', db_time: result.rows[0].time });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
