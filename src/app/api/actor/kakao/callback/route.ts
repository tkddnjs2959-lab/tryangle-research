import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  findActorAccountByKakaoUserId,
  getActorAccountByProgressToken,
  linkActorToKakao,
} from '@/lib/actor-account';
import { createActorSession } from '@/lib/actor-session';
import { exchangeKakaoCode, getKakaoUser } from '@/lib/kakao-login';
import { audit } from '@/lib/audit';

const STATE_COOKIE = 'actor_kakao_state';

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get('error');
  if (error) {
    const safeError = error === 'access_denied' ? 'kakao_cancelled' : 'kakao_login_failed';
    return NextResponse.redirect(new URL(`/actor?error=${safeError}`, req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const jar = await cookies();
  const rawState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  const [expectedState, progressToken] = rawState?.split('.') ?? [];
  if (!code || !state || !expectedState || state !== expectedState || !progressToken) {
    return NextResponse.redirect(new URL('/actor?error=invalid_state', req.url));
  }

  const actor = await getActorAccountByProgressToken(progressToken);
  if (!actor) return NextResponse.redirect(new URL('/actor?error=invalid_actor', req.url));

  try {
    const token = await exchangeKakaoCode({ code, origin: req.nextUrl.origin });
    const kakao = await getKakaoUser(token.accessToken);
    const alreadyLinked = await findActorAccountByKakaoUserId(kakao.id);

    if (alreadyLinked && alreadyLinked.id !== actor.id) {
      return NextResponse.redirect(new URL('/actor?error=kakao_already_linked', req.url));
    }

    await linkActorToKakao({
      actorId: actor.id,
      kakaoUserId: kakao.id,
      kakaoNickname: kakao.nickname,
      refreshToken: token.refreshToken,
      refreshTokenExpiresIn: token.refreshTokenExpiresIn,
    });
    await audit({
      action: 'kakao_link',
      targetType: 'actor',
      targetId: actor.id,
      summary: '배우 카카오 계정을 연결했습니다.',
      detail: { hasMessageRefreshToken: Boolean(token.refreshToken) },
    });
    await createActorSession(actor.id, kakao.id);

    return NextResponse.redirect(new URL('/actor', req.url));
  } catch (e) {
    console.error('배우 카카오 연결 실패', { actorId: actor.id, error: e });
    await audit({
      action: 'kakao_link_failed',
      targetType: 'actor',
      targetId: actor.id,
      summary: '배우 카카오 계정 연결에 실패했습니다.',
    });
    return NextResponse.redirect(new URL('/actor?error=kakao_login_failed', req.url));
  }
}
