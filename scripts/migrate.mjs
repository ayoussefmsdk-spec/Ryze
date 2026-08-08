// Apply db/schema.sql idempotently. Runs each statement independently and skips
// "already exists" errors, so adding new tables/columns to schema.sql and
// redeploying safely creates only the new objects on an existing database.
import fs from 'node:fs';
import { getPool } from '../lib/db.mjs';

const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

// Split on semicolons, respecting single-quoted strings, $$ dollar-quotes, and
// -- line comments (so apostrophes inside comments don't break quote tracking).
function splitStatements(text) {
  const out = [];
  let cur = '';
  let inSingle = false;
  let inDollar = false;
  let inComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const two = text.slice(i, i + 2);
    if (inComment) { cur += ch; if (ch === '\n') inComment = false; continue; }
    if (!inSingle && !inDollar && two === '--') { inComment = true; cur += two; i++; continue; }
    if (!inSingle && two === '$$') { inDollar = !inDollar; cur += two; i++; continue; }
    if (!inDollar && ch === "'") { inSingle = !inSingle; cur += ch; continue; }
    if (ch === ';' && !inSingle && !inDollar) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  // For each chunk, drop leading blank/comment-only lines, then keep if any SQL remains.
  return out
    .map((s) => {
      const lines = s.split('\n');
      while (lines.length && (/^\s*$/.test(lines[0]) || /^\s*--/.test(lines[0]))) lines.shift();
      return lines.join('\n').trim();
    })
    .filter((s) => s.length > 0);
}

const statements = splitStatements(sql);
const pool = getPool();
let created = 0;
let skipped = 0;

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    created++;
  } catch (err) {
    if (/already exists|duplicate/i.test(err.message)) {
      skipped++;
    } else {
      console.error('migration statement failed:\n', stmt.slice(0, 120), '\n', err.message);
      await pool.end();
      process.exit(1);
    }
  }
}

console.log(`✓ migrate done — ${created} applied, ${skipped} already present`);
await pool.end();
