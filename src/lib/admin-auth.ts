import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { db } from './supabase';
import { privacyHash } from './consultation-crypto';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-tryangle_admin' : 'tryangle_admin_session';
const MAX_AGE = 60 * 60 * 2;
const IDLE_AGE_MS = 30 * 60 * 1000;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET 환경변수가 없습니다.');
  return value;
}

function sign(value: string | number) {
  return createHmac('sha256', secret()).update(String(value)).digest('hex');
}

function safeEqual(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function checkPassword(input: string) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD 환경변수가 없습니다.');
  return safeEqual(sign(input), sign(password));
}

export function checkAdminId(input: string) {
  const expected = process.env.ADMIN_LOGIN_ID?.trim() || 'admin';
  return safeEqual(sign(input.trim()), sign(expected));
}

function adminId() {
  return process.env.ADMIN_LOGIN_ID?.trim() || 'admin';
}

export async function createSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const token = randomBytes(32).toString('base64url');
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    || requestHeaders.get('x-real-ip')?.trim()
    || 'unknown';
  const userAgent = requestHeaders.get('user-agent') || 'unknown';
  await db().from('admin_sessions').delete().lt('expires_at', new Date().toISOString());
  const { error } = await db().from('admin_sessions').insert({
    token_hash: privacyHash(token),
    admin_id: adminId(),
    expires_at: new Date(expires).toISOString(),
    ip_hash: privacyHash(ip),
    user_agent_hash: privacyHash(userAgent),
  });
  if (error) throw new Error(`관리자 세션을 만들지 못했습니다: ${error.message}`);

  const jar = await cookies();
  jar.set(COOKIE, `${token}.${expires}.${sign(`${token}.${expires}`)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value.split('.')[0];
  if (token) {
    await db().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', privacyHash(token));
  }
  jar.delete(COOKIE);
}

export async function isLoggedIn() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [token, expiresText, signature] = raw.split('.');
  const expires = Number(expiresText);
  if (!token || !signature || !Number.isFinite(expires) || expires < Date.now()) return false;

  try {
    if (!safeEqual(signature, sign(`${token}.${expires}`))) return false;
    const { data, error } = await db()
      .from('admin_sessions')
      .select('token_hash,last_seen_at')
      .eq('token_hash', privacyHash(token))
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return false;
    const lastSeen = new Date(data.last_seen_at as string).getTime();
    if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > IDLE_AGE_MS) {
      await db().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', privacyHash(token));
      return false;
    }
    if (Date.now() - lastSeen > 5 * 60 * 1000) {
      await db().from('admin_sessions').update({ last_seen_at: new Date().toISOString() }).eq('token_hash', privacyHash(token));
    }
    return true;
  } catch {
    return false;
  }
}

export async function currentAdminId() {
  return (await isLoggedIn()) ? adminId() : null;
}

export async function revokeOtherAdminSessions() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value.split('.')[0];
  if (!token) return;
  await db()
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null)
    .neq('token_hash', privacyHash(token));
}
