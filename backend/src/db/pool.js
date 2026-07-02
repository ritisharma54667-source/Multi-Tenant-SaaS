// ============================================================
// DATABASE CONNECTION POOL
// ============================================================
// Single shared pg Pool used across the app. Every query that
// touches tenant-scoped data should go through `withTenantClient`
// (see below) so the RLS session variable is set correctly.
// ============================================================

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

// ------------------------------------------------------------
// withTenantClient(tenantId, callback)
// ------------------------------------------------------------
// Checks out a single client from the pool, sets the Postgres
// session variable `app.current_tenant_id` for THAT connection
// only, runs your callback, then releases the client.
//
// This is the function every tenant-scoped route handler should
// use instead of pool.query() directly — it guarantees RLS is
// active for the duration of the query.
// ------------------------------------------------------------
export async function withTenantClient(tenantId, callback) {
  const client = await pool.connect();
  try {
    if (tenantId) {
      // set_config(..., true) scopes the variable to this transaction/session only
      await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    }
    return await callback(client);
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------
// query(text, params)
// ------------------------------------------------------------
// Plain, non-tenant-scoped query helper. Only use this for
// global tables (users, tenants, memberships lookups by user)
// — never for tenant-owned business data.
// ------------------------------------------------------------
export async function query(text, params) {
  return pool.query(text, params);
}
