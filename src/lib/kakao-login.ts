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

/**
 * 배우 로그인에서 추가로 받을 동의항목.
 *
 * 비워두면 기본 동의항목만 받는다 (지금까지의 동작).
 * `talk_message` 를 넣으면 주차 공개 알림을 배우 카카오톡으로 보낼 수 있다.
 *
 * 다만 **카카오 디벨로퍼스에서 그 동의항목을 먼저 켜야 한다.**
 * 켜지 않은 스코프를 요청하면 카카오가 인가 자체를 거부해서 로그인이 막힌다.
 * 그래서 코드에 박지 않고 환경변수로 열어둔다 — 콘솔에서 켠 뒤 값을 넣는다.
 */
export function kakaoActorScopes(): string | null {
  const raw = process.env.KAKAO_ACTOR_SCOPES?.trim();
  return raw ? raw : null;
}

export type KakaoToken = {
  accessToken: string;
  /** 재로그인 없이 나중에 메시지를 보내려면 이게 필요하다 (~60일) */
  refreshToken: string | null;
  refreshTokenExpiresIn: number | null;
};

export async function exchangeKakaoCode(input: {
  code: string;
  origin: string;
}): Promise<KakaoToken> {
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
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || '카카오 토큰 발급에 실패했습니다.');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    refreshTokenExpiresIn: json.refresh_token_expires_in ?? null,
  };
}

/** 저장해둔 refresh_token 으로 access_token 을 새로 받는다. */
export async function refreshKakaoAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  refreshTokenExpiresIn: number | null;
} | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: kakaoRestKey(),
    refresh_token: refreshToken,
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
  if (!res.ok) {
    console.error('배우 카카오 토큰 갱신 실패', res.status, await res.text().catch(() => ''));
    return null;
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };
  return {
    accessToken: json.access_token,
    // 만료가 가까울 때만 카카오가 새 refresh_token 을 함께 준다.
    refreshToken: json.refresh_token ?? null,
    refreshTokenExpiresIn: json.refresh_token_expires_in ?? null,
  };
}

/** 배우 본인의 '나와의 채팅' 으로 텍스트를 보낸다. */
export async function sendKakaoMemo(input: {
  accessToken: string;
  text: string;
  linkUrl?: string | null;
}): Promise<boolean> {
  const template = {
    object_type: 'text',
    text: input.text,
    link: input.linkUrl ? { web_url: input.linkUrl, mobile_web_url: input.linkUrl } : {},
  };

  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error('배우 카카오 메시지 발송 실패', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
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
