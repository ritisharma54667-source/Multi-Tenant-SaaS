// ============================================================
// DB SETUP SCRIPT
// Run with: npm run db:setup
// Reads schema.sql and executes it against DATABASE_URL.
// Safe to re-run (uses CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS).
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setup() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[db:setup] Running schema.sql against DATABASE_URL...');
  try {
    await pool.query(sql);
    console.log('[db:setup] ✅ Schema applied successfully.');
  } catch (err) {
    console.error('[db:setup] ❌ Failed to apply schema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setup();
