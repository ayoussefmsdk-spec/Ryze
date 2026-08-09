import { NextResponse } from 'next/server';
import { createSessionToken, verifyPassword, SESSION_COOKIE, SESSION_MAX_AGE } from '../../../lib/auth.mjs';
import { limited, clientIp } from '../../../lib/ratelimit.mjs';

export async function POST(req) {
  const ip = clientIp(req.headers);
  if (limited(`login:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — wait a bit.' }, { status: 429 });
  }

  let password = '';
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
