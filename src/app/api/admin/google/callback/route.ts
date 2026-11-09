import { NextRequest, NextResponse } from 'next/server';
import { createSession, findActiveAdminAccount } from '@/lib/admin-auth';
import {
  googleClient,
  googleConfig,
  GOOGLE_OAUTH_COOKIE,
  isGoogleAdminLoginEnabled,
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
  if (intent.mode !== 'login') {
    return redirectWithCookieCleared(req, '/admin/login?google_error=forbidden');
  }

  try {
    const config = googleConfig(req.nextUrl.origin);
    const subject = await verifiedGoogleSubject({
      client: googleClient(config),
      clientId: config.clientId,
      code,
      nonce: intent.nonce,
    });
    const identity = await findActiveAdminAccount('google', subject);
    if (!identity) return redirectWithCookieCleared(req, '/admin/login?google_error=not_allowed');

    await createSession(identity);
    await db().from('admin_audit_log').insert({
      admin_id: identity.adminId,
      admin_account_id: identity.accountId,
      action: 'admin_login',
      target_type: 'admin',
      target_id: identity.accountId,
      summary: 'Google administrator signed in.',
      detail: { provider: 'google', role: identity.role },
    });
    return redirectWithCookieCleared(req, '/admin');
  } catch (error) {
    console.error('Google administrator callback failed', error instanceof Error ? error.message : error);
    return redirectWithCookieCleared(req, '/admin/login?google_error=failed');
  }
}
