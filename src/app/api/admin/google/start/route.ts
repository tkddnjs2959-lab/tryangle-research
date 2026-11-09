import { NextRequest, NextResponse } from 'next/server';
import {
  createGoogleOAuthIntent,
  googleClient,
  googleConfig,
  GOOGLE_OAUTH_COOKIE,
  isGoogleAdminLoginEnabled,
} from '@/lib/admin-google-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isGoogleAdminLoginEnabled()) return new NextResponse(null, { status: 404 });
  if (req.nextUrl.searchParams.get('mode') === 'link') return new NextResponse(null, { status: 403 });

  try {
    const config = googleConfig(req.nextUrl.origin);
    const client = googleClient(config);
    const { intent, cookieValue } = createGoogleOAuthIntent('login', null);
    const url = client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email'],
      prompt: 'select_account',
      state: intent.state,
      nonce: intent.nonce,
    });
    const response = NextResponse.redirect(url);
    response.cookies.set(GOOGLE_OAUTH_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error('Google 관리자 로그인 시작 실패', error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL('/admin/login?google_error=config', req.url));
  }
}

