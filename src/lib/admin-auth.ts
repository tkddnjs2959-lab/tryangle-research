import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { db } from './supabase';
import { privacyHash } from './consultation-crypto';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-tryangle_admin' : 'tryangle_admin_session';
const MAX_AGE = 60 * 60 * 2;
const IDLE_AGE_MS = 30 * 60 * 1000;

export type AdminAuthProvider = 'password' | 'kakao' | 'google';
export type AdminRole = 'owner' | 'admin' | 'viewer';

export type AdminIdentity = {
  accountId: string;
  adminId: string;
  displayLabel: string;
  role: AdminRole;
  authProvider: AdminAuthProvider;
};

type AdminAccountRow = {
  id: string;
  auth_provider: AdminAuthProvider;
  display_label: string;
  role: AdminRole;
  active: boolean;
  revoked_at: string | null;
};

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

function subjectHash(provider: AdminAuthProvider, subject: string) {
  return privacyHash(`admin:${provider}:${subject.trim()}`);
}

function identityFromRow(row: AdminAccountRow): AdminIdentity {
  return {
    accountId: row.id,
    adminId: row.display_label,
    displayLabel: row.display_label,
    role: row.role,
    authProvider: row.auth_provider,
  };
}

/** OAuth 콜백에서도 동일하게 사용할 관리자 허용 목록 조회 함수. */
export async function findActiveAdminAccount(
  provider: AdminAuthProvider,
  providerSubject: string
): Promise<AdminIdentity | null> {
  const { data, error } = await db()
    .from('admin_accounts')
    .select('id,auth_provider,display_label,role,active,revoked_at')
    .eq('auth_provider', provider)
    .eq('provider_subject_hash', subjectHash(provider, providerSubject))
    .maybeSingle();
  if (error || !data || !data.active || data.revoked_at) return null;
  return identityFromRow(data as AdminAccountRow);
}

/**
 * 기존 환경변수 로그인은 최초 1회에 한해 owner 계정으로 등록한다.
 * 허용 목록이 생긴 뒤에는 환경변수 변경만으로 새 관리자를 만들 수 없다.
 */
export async function ensureLegacyAdminAccount(inputAdminId: string): Promise<AdminIdentity | null> {
  const existing = await findActiveAdminAccount('password', inputAdminId);
  if (existing) return existing;

  const { count, error: countError } = await db()
    .from('admin_accounts')
    .select('id', { count: 'exact', head: true });
  if (countError || (count ?? 0) > 0) return null;

  const { data, error } = await db()
    .from('admin_accounts')
    .insert({
      auth_provider: 'password',
      provider_subject_hash: subjectHash('password', inputAdminId),
      display_label: adminId(),
      role: 'owner',
    })
    .select('id,auth_provider,display_label,role,active,revoked_at')
    .single();
  if (error || !data) return null;
  return identityFromRow(data as AdminAccountRow);
}

export async function createSession(identity: AdminIdentity) {
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
    admin_id: identity.adminId,
    admin_account_id: identity.accountId,
    auth_provider: identity.authProvider,
    role_snapshot: identity.role,
    expires_at: new Date(expires).toISOString(),
    ip_hash: privacyHash(ip),
    user_agent_hash: privacyHash(userAgent),
  });
  if (error) throw new Error(`관리자 세션을 만들지 못했습니다: ${error.message}`);
  await db()
    .from('admin_accounts')
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', identity.accountId);

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

async function verifiedIdentity(): Promise<AdminIdentity | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [token, expiresText, signature] = raw.split('.');
  const expires = Number(expiresText);
  if (!token || !signature || !Number.isFinite(expires) || expires < Date.now()) return null;

  try {
    if (!safeEqual(signature, sign(`${token}.${expires}`))) return null;
    const { data, error } = await db()
      .from('admin_sessions')
      .select('token_hash,last_seen_at,admin_account_id')
      .eq('token_hash', privacyHash(token))
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data?.admin_account_id) return null;

    const { data: account, error: accountError } = await db()
      .from('admin_accounts')
      .select('id,auth_provider,display_label,role,active,revoked_at')
      .eq('id', data.admin_account_id)
      .maybeSingle();
    if (accountError || !account || !account.active || account.revoked_at) {
      await db().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', privacyHash(token));
      return null;
    }
    const lastSeen = new Date(data.last_seen_at as string).getTime();
    if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > IDLE_AGE_MS) {
      await db().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', privacyHash(token));
      return null;
    }
    if (Date.now() - lastSeen > 5 * 60 * 1000) {
      await db().from('admin_sessions').update({ last_seen_at: new Date().toISOString() }).eq('token_hash', privacyHash(token));
    }
    return identityFromRow(account as AdminAccountRow);
  } catch {
    return null;
  }
}

export async function isLoggedIn() {
  return Boolean(await verifiedIdentity());
}

export async function currentAdminIdentity() {
  return verifiedIdentity();
}

export async function hasAdminRole(roles: readonly AdminRole[]) {
  const identity = await verifiedIdentity();
  return Boolean(identity && roles.includes(identity.role));
}

export async function currentAdminId() {
  return (await verifiedIdentity())?.adminId ?? null;
}

export async function revokeOtherAdminSessions() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value.split('.')[0];
  if (!token) return;
  const identity = await verifiedIdentity();
  if (!identity) return;
  await db()
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('admin_account_id', identity.accountId)
    .is('revoked_at', null)
    .neq('token_hash', privacyHash(token));
}
