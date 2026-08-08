// Apply db/schema.sql to the database in DATABASE_URL.
// Safe to run once on a fresh database; reports if it looks already-applied.
import fs from 'node:fs';
import { getPool } from '../lib/db.mjs';

const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const pool = getPool();

try {
  await pool.query(sql);
  console.log('✓ schema applied');
} catch (err) {
  if (/already exists/i.test(err.message)) {
    console.log('• schema already applied (nothing to do)');
  } else {
    console.error('migration failed:', err.message);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
