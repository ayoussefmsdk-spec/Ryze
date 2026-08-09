// Single-password auth. Login verifies APP_PASSWORD and sets a signed session
// cookie; every protected page/route verifies that cookie. All server-side.
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'ryze_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || 'dev-only-secret';
}

function hmac(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

export function createSessionToken() {
  const payload = `ok:${Date.now()}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const value = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = hmac(value);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  // The token itself expires too — a leaked cookie value can't live forever.
  const issuedAt = Number(value.split(':')[1]);
  return Number.isFinite(issuedAt) && Date.now() - issuedAt <= MAX_AGE * 1000;
}

export function verifyPassword(input) {
  const expected = process.env.APP_PASSWORD || '';
  if (!expected || typeof input !== 'string') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Read the session from cookies (server components / route handlers). */
export function hasSession() {
  const token = cookies().get(COOKIE)?.value;
  return verifySessionToken(token);
}

/** Guard a server component — redirects to /login when not authenticated. */
export function requireSession() {
  if (!hasSession()) redirect('/login');
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;
