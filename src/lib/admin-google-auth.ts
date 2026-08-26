import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { db } from './supabase';
import { privacyHash } from './consultation-crypto';
import type { AdminIdentity } from './admin-auth';

export const GOOGLE_OAUTH_COOKIE = '__Host-tryangle_admin_google_oauth';
export const GOOGLE_MFA_COOKIE = '__Host-tryangle_admin_google_mfa';

type OAuthIntent = {
  state: string;
  nonce: string;
  mode: 'login' | 'link';
  adminAccountId: string | null;
  expires: number;
};

type PendingMfa = { accountId: string; expires: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET 환경변수가 없습니다.');
  return value;
}

function safeEqual(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

function seal(value: object) {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function unseal<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const [body, signature] = raw.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function isGoogleAdminLoginEnabled() {
  return process.env.GOOGLE_ADMIN_LOGIN_ENABLED === 'true';
}

export function googleConfig(origin: string) {
  const clientId = process.env.GOOGLE_ADMIN_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADMIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_ADMIN_REDIRECT_URI?.trim()
    || `${origin}/api/admin/google/callback`;
  if (!clientId || !clientSecret || !process.env.ADMIN_TOTP_SECRET?.trim()) {
    throw new Error('Google 관리자 로그인 또는 인증 앱 설정이 완료되지 않았습니다.');
  }
  return { clientId, clientSecret, redirectUri };
}

export function createGoogleOAuthIntent(mode: 'login' | 'link', adminAccountId: string | null) {
  const intent: OAuthIntent = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    mode,
    adminAccountId,
    expires: Date.now() + 10 * 60 * 1000,
  };
  return { intent, cookieValue: seal(intent) };
}

export function verifyGoogleOAuthIntent(raw: string | undefined, state: string) {
  const intent = unseal<OAuthIntent>(raw);
  if (!intent || intent.expires < Date.now() || !safeEqual(intent.state, state)) return null;
  if (!['login', 'link'].includes(intent.mode)) return null;
  return intent;
}

export function googleClient(config: ReturnType<typeof googleConfig>) {
  return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

export async function verifiedGoogleSubject(input: {
  client: OAuth2Client;
  clientId: string;
  code: string;
  nonce: string;
}) {
  const { tokens } = await input.client.getToken(input.code);
  if (!tokens.id_token) throw new Error('Google ID 토큰이 없습니다.');
  const ticket = await input.client.verifyIdToken({ idToken: tokens.id_token, audience: input.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email_verified || payload.nonce !== input.nonce) {
    throw new Error('Google 계정 확인에 실패했습니다.');
  }
  return payload.sub;
}

export function createGoogleMfaCookie(identity: AdminIdentity) {
  return seal({ accountId: identity.accountId, expires: Date.now() + 5 * 60 * 1000 } satisfies PendingMfa);
}

export function readGoogleMfaCookie(raw: string | undefined) {
  const pending = unseal<PendingMfa>(raw);
  if (!pending || pending.expires < Date.now()) return null;
  return pending;
}

export async function linkGoogleAdminAccount(owner: AdminIdentity, googleSubject: string) {
  if (owner.role !== 'owner') return { identity: null, created: false };
  const subject = privacyHash(`admin:google:${googleSubject.trim()}`);
  const { data: existing } = await db()
    .from('admin_accounts')
    .select('id,auth_provider,display_label,role,active,revoked_at')
    .eq('auth_provider', 'google')
    .eq('provider_subject_hash', subject)
    .maybeSingle();
  if (existing) {
    const active = Boolean(existing.active && !existing.revoked_at);
    return {
      identity: active ? {
        accountId: existing.id as string,
        adminId: existing.display_label as string,
        displayLabel: existing.display_label as string,
        role: existing.role as AdminIdentity['role'],
        authProvider: 'google' as const,
      } : null,
      created: false,
    };
  }

  const { data, error } = await db()
    .from('admin_accounts')
    .insert({
      auth_provider: 'google',
      provider_subject_hash: subject,
      display_label: `${owner.displayLabel} · Google`,
      role: owner.role,
      created_by: owner.accountId,
    })
    .select('id,display_label,role')
    .single();
  if (error || !data) throw new Error('Google 관리자 계정을 허용 목록에 추가하지 못했습니다.');
  return {
    identity: {
      accountId: data.id as string,
      adminId: data.display_label as string,
      displayLabel: data.display_label as string,
      role: data.role as AdminIdentity['role'],
      authProvider: 'google' as const,
    },
    created: true,
  };
}
