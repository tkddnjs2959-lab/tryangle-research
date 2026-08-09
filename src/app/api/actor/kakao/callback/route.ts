import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  findActorAccountByKakaoUserId,
  getActorAccountByProgressToken,
  linkActorToKakao,
} from '@/lib/actor-account';
import { createActorSession } from '@/lib/actor-session';
import { exchangeKakaoCode, getKakaoUser } from '@/lib/kakao-login';

const STATE_COOKIE = 'actor_kakao_state';

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get('error');
  if (error) return NextResponse.redirect(new URL(`/actor?error=${encodeURIComponent(error)}`, req.url));

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
    await createActorSession(actor.id, kakao.id);

    return NextResponse.redirect(new URL('/actor', req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : '카카오 로그인에 실패했습니다.';
    return NextResponse.redirect(new URL(`/actor?error=${encodeURIComponent(msg)}`, req.url));
  }
}
