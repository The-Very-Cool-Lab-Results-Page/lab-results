import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Per-token proof that the patient confirmed their date of birth. The cookie is
 * httpOnly and its value is an HMAC of the token, so it cannot be forged without
 * the server secret. The date of birth itself is never stored in the cookie or
 * logged anywhere.
 */

const SECRET = process.env.SESSION_SECRET ?? 'dev-only-insecure-session-secret-do-not-use-in-prod';
const TTL_SECONDS = 60 * 30;

function cookieName(token: string): string {
  return `dob_${token}`;
}

function sign(token: string): string {
  return createHmac('sha256', SECRET).update(token).digest('base64url');
}

export async function setDobConfirmed(token: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(token), sign(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

/** Consecutive misses after which the gate offers the clinic's phone number. */
export const DOB_HELP_AFTER_ATTEMPTS = 3;

function attemptsCookieName(token: string): string {
  return `dob_tries_${token}`;
}

/**
 * Count consecutive failed attempts so the gate can offer a phone number instead
 * of repeating the same refusal. Attempts are never limited — this gates helpful
 * copy, not access, which is also why the counter is unsigned: forging it cannot
 * open a report. What the patient typed is never stored or logged (safety rule 5).
 */
export async function recordFailedDobAttempt(token: string): Promise<number> {
  const store = await cookies();
  const previous = Number(store.get(attemptsCookieName(token))?.value);
  const next = Number.isInteger(previous) && previous > 0 ? Math.min(previous + 1, 99) : 1;
  store.set(attemptsCookieName(token), String(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
  return next;
}

export async function clearDobAttempts(token: string): Promise<void> {
  const store = await cookies();
  store.delete(attemptsCookieName(token));
}

export async function isDobConfirmed(token: string): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(cookieName(token));
  if (cookie === undefined) return false;
  const expected = sign(token);
  const a = Buffer.from(cookie.value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
