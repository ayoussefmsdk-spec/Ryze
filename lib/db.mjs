// Thin Postgres access layer. One shared pool; a `query` helper for raw SQL.
import pg from 'pg';

const { Pool } = pg;

// Return Postgres `date` columns as plain 'YYYY-MM-DD' strings, not JS Dates —
// avoids timezone drift and keeps date math/string comparisons simple.
pg.types.setTypeParser(1082, (v) => v);

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      // Managed Postgres (Railway) requires SSL; local usually does not.
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
