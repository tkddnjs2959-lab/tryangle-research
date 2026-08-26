import { NextRequest, NextResponse } from 'next/server';
import { findActiveAdminAccount, findActiveAdminAccountById } from '@/lib/admin-auth';
import {
  createGoogleMfaCookie,
  createGoogleBootstrapMfaCookie,
  googleClient,
  googleConfig,
  GOOGLE_MFA_COOKIE,
  GOOGLE_OAUTH_COOKIE,
  isGoogleAdminLoginEnabled,
  linkGoogleAdminAccount,
  verifiedGoogleSubject,
  verifyGoogleOAuthIntent,
} from '@/lib/admin-google-auth';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function redirectWithCookieCleared(req: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, req.url));
  response.cookies.delete(GOOGLE_OAUTH_COOKIE);
  return response;
}

export async function GET(req: NextRequest) {
  if (!isGoogleAdminLoginEnabled()) return new NextResponse(null, { status: 404 });
  const state = req.nextUrl.searchParams.get('state') || '';
  const code = req.nextUrl.searchParams.get('code') || '';
  const intent = verifyGoogleOAuthIntent(req.cookies.get(GOOGLE_OAUTH_COOKIE)?.value, state);
  if (!intent || !code || req.nextUrl.searchParams.has('error')) {
    return redirectWithCookieCleared(req, '/admin/login?google_error=invalid');
  }

  try {
    const config = googleConfig(req.nextUrl.origin);
    const subject = await verifiedGoogleSubject({
      client: googleClient(config),
      clientId: config.clientId,
      code,
      nonce: intent.nonce,
    });

    if (intent.mode === 'link') {
      const owner = intent.adminAccountId ? await findActiveAdminAccountById(intent.adminAccountId) : null;
      if (!owner || owner.role !== 'owner') return redirectWithCookieCleared(req, '/admin/login?google_error=forbidden');
      const linked = await linkGoogleAdminAccount(owner, subject);
      if (!linked.identity) return redirectWithCookieCleared(req, '/admin?google_link=revoked');
      await db().from('admin_audit_log').insert({
        admin_id: owner.adminId,
        admin_account_id: owner.accountId,
        action: 'admin_account_add',
        target_type: 'admin',
        target_id: linked.identity.accountId,
        summary: linked.created ? 'Google 관리자 계정을 연결했습니다.' : '이미 연결된 Google 관리자 계정을 확인했습니다.',
        detail: { provider: 'google' },
      });
      return redirectWithCookieCleared(req, `/admin?google_link=${linked.created ? 'success' : 'existing'}`);
    }

    const identity = await findActiveAdminAccount('google', subject);
    if (!identity) {
      const { count, error: countError } = await db()
        .from('admin_accounts')
        .select('id', { count: 'exact', head: true });
      if (countError || (count ?? 0) !== 0) return redirectWithCookieCleared(req, '/admin/login?google_error=not_allowed');
      const response = redirectWithCookieCleared(req, '/admin/login?google_mfa=1&google_bootstrap=1');
      response.cookies.set(GOOGLE_MFA_COOKIE, createGoogleBootstrapMfaCookie(subject), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 5 * 60,
      });
      return response;
    }
    const response = redirectWithCookieCleared(req, '/admin/login?google_mfa=1');
    response.cookies.set(GOOGLE_MFA_COOKIE, createGoogleMfaCookie(identity), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 5 * 60,
    });
    return response;
  } catch (error) {
    console.error('Google 관리자 로그인 콜백 실패', error instanceof Error ? error.message : error);
    return redirectWithCookieCleared(req, '/admin/login?google_error=failed');
  }
}
