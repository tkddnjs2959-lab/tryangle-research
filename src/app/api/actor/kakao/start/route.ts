import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getActorAccountByProgressToken } from '@/lib/actor-account';
import { kakaoActorScopes, kakaoRedirectUri, kakaoRestKey } from '@/lib/kakao-login';

const STATE_COOKIE = 'actor_kakao_state';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const actor = await getActorAccountByProgressToken(token);
  if (!actor) return NextResponse.redirect(new URL('/actor?error=invalid_token', req.url));

  const state = randomBytes(16).toString('hex');
  const jar = await cookies();
  jar.set(STATE_COOKIE, `${state}.${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const authorize = new URL('https://kauth.kakao.com/oauth/authorize');
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', kakaoRestKey());
  authorize.searchParams.set('redirect_uri', kakaoRedirectUri(req.nextUrl.origin));
  authorize.searchParams.set('state', state);

  // 주차 알림용 동의항목. 콘솔에서 켜기 전에는 비워둬야 로그인이 막히지 않는다.
  const scopes = kakaoActorScopes();
  if (scopes) authorize.searchParams.set('scope', scopes);

  return NextResponse.redirect(authorize);
}
