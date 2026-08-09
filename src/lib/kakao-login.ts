import 'server-only';

export type KakaoUser = {
  id: string;
  nickname: string | null;
};

export function kakaoRestKey() {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error('KAKAO_REST_API_KEY 환경변수가 없습니다.');
  return key;
}

export function kakaoRedirectUri(origin: string) {
  return process.env.KAKAO_ACTOR_REDIRECT_URI || `${origin}/api/actor/kakao/callback`;
}

export async function exchangeKakaoCode(input: {
  code: string;
  origin: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: kakaoRestKey(),
    redirect_uri: kakaoRedirectUri(input.origin),
    code: input.code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    cache: 'no-store',
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || '카카오 토큰 발급에 실패했습니다.');
  }
  return json.access_token;
}

export async function getKakaoUser(accessToken: string): Promise<KakaoUser> {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const json = (await res.json()) as {
    id?: number | string;
    properties?: { nickname?: string };
    kakao_account?: { profile?: { nickname?: string } };
    msg?: string;
  };
  if (!res.ok || json.id == null) throw new Error(json.msg || '카카오 사용자 정보 조회에 실패했습니다.');
  return {
    id: String(json.id),
    nickname: json.kakao_account?.profile?.nickname ?? json.properties?.nickname ?? null,
  };
}
