import 'server-only';
import { db } from './supabase';
import type { Gender } from './types';

/**
 * 배우 계정(카카오 연결)과 배우가 직접 등록한 프로필.
 *
 * 예전에는 이 값들을 actors.note 안에 [[kakao_user_id:...]] 같은 문자열로
 * 넣어뒀는데, note 는 대표가 쓰는 메모 칸이라 편집하다 마커가 지워지면
 * 로그인이 조용히 끊겼다. 지금은 actor_accounts 테이블에 따로 둔다.
 * actors.note 에 기계가 읽는 값을 다시 넣지 말 것.
 */

export type ActorProfile = {
  name: string;
  phone: string;
  memo: string;
  kakaoNickname?: string | null;
  updatedAt: string;
};

export type ActorAccount = {
  id: string;
  name: string;
  birthYear: number | null;
  gender: Gender;
  cohort: string | null;
  progressToken: string;
  kakaoUserId: string | null;
  profile: ActorProfile | null;
};

type ActorRowShape = {
  id: string;
  name: string;
  birth_year: number | null;
  gender: Gender;
  cohort: string | null;
  progress_token: string;
};

type AccountRowShape = {
  actor_id: string;
  kakao_user_id: string | null;
  kakao_nickname: string | null;
  name: string | null;
  phone: string | null;
  memo: string | null;
  updated_at: string;
  kakao_refresh_token: string | null;
  kakao_refresh_expires_at: string | null;
  notify_enabled: boolean;
  notified_weeks: number[] | null;
};

const ACTOR_COLS = 'id, name, birth_year, gender, cohort, progress_token';
// supabase-js 는 이 문자열 리터럴에서 반환 타입을 추론한다.
// 여러 줄로 이어붙이면 타입이 string 이 되면서 추론이 깨지므로 한 줄로 둔다.
const ACCOUNT_COLS = 'actor_id, kakao_user_id, kakao_nickname, name, phone, memo, updated_at, kakao_refresh_token, kakao_refresh_expires_at, notify_enabled, notified_weeks';

/** 프로필은 배우가 뭐라도 등록했을 때만 만든다 — 카카오만 연결한 상태와 구분한다. */
function toProfile(row: AccountRowShape | null): ActorProfile | null {
  if (!row) return null;
  const hasAny = Boolean(row.name || row.phone || row.memo);
  if (!hasAny) return null;
  return {
    name: row.name ?? '',
    phone: row.phone ?? '',
    memo: row.memo ?? '',
    kakaoNickname: row.kakao_nickname,
    updatedAt: row.updated_at,
  };
}

function toAccount(actor: ActorRowShape, account: AccountRowShape | null): ActorAccount {
  return {
    id: actor.id,
    name: actor.name,
    birthYear: actor.birth_year,
    gender: actor.gender,
    cohort: actor.cohort,
    progressToken: actor.progress_token,
    kakaoUserId: account?.kakao_user_id ?? null,
    profile: toProfile(account),
  };
}

async function loadAccount(actorId: string): Promise<AccountRowShape | null> {
  const { data, error } = await db()
    .from('actor_accounts')
    .select(ACCOUNT_COLS)
    .eq('actor_id', actorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AccountRowShape | null) ?? null;
}

export async function getActorAccountByProgressToken(token: string): Promise<ActorAccount | null> {
  const { data, error } = await db()
    .from('actors')
    .select(ACTOR_COLS)
    .eq('progress_token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const actor = data as ActorRowShape;
  return toAccount(actor, await loadAccount(actor.id));
}

export async function getActorAccountById(id: string): Promise<ActorAccount | null> {
  const { data, error } = await db()
    .from('actors')
    .select(ACTOR_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const actor = data as ActorRowShape;
  return toAccount(actor, await loadAccount(actor.id));
}

/** 카카오 ID 로 배우를 찾는다. 인덱스가 걸린 컬럼이라 정확히 일치로 조회한다. */
export async function findActorAccountByKakaoUserId(
  kakaoUserId: string
): Promise<ActorAccount | null> {
  const { data: account, error } = await db()
    .from('actor_accounts')
    .select(ACCOUNT_COLS)
    .eq('kakao_user_id', kakaoUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) return null;

  const row = account as AccountRowShape;
  const { data: actor, error: actorError } = await db()
    .from('actors')
    .select(ACTOR_COLS)
    .eq('id', row.actor_id)
    .maybeSingle();
  if (actorError) throw new Error(actorError.message);
  if (!actor) return null;

  return toAccount(actor as ActorRowShape, row);
}

export async function linkActorToKakao(input: {
  actorId: string;
  kakaoUserId: string;
  kakaoNickname?: string | null;
  /** talk_message 동의를 받았을 때만 들어온다. 없으면 기존 값을 지우지 않는다. */
  refreshToken?: string | null;
  refreshTokenExpiresIn?: number | null;
}) {
  const existing = await loadAccount(input.actorId);

  const refreshExpiresAt =
    input.refreshToken && input.refreshTokenExpiresIn
      ? new Date(Date.now() + input.refreshTokenExpiresIn * 1000).toISOString()
      : (existing?.kakao_refresh_expires_at ?? null);

  const { error } = await db()
    .from('actor_accounts')
    .upsert(
      {
        actor_id: input.actorId,
        kakao_user_id: input.kakaoUserId,
        // 카카오가 닉네임을 안 주면 이미 저장된 값을 지우지 않는다.
        kakao_nickname: input.kakaoNickname ?? existing?.kakao_nickname ?? null,
        kakao_refresh_token: input.refreshToken ?? existing?.kakao_refresh_token ?? null,
        kakao_refresh_expires_at: refreshExpiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'actor_id' }
    );
  if (error) throw new Error(error.message);
}

export async function updateActorProfile(input: {
  actorId: string;
  name: string;
  phone: string;
  memo: string;
}) {
  const existing = await loadAccount(input.actorId);

  const { error } = await db()
    .from('actor_accounts')
    .upsert(
      {
        actor_id: input.actorId,
        kakao_user_id: existing?.kakao_user_id ?? null,
        kakao_nickname: existing?.kakao_nickname ?? null,
        name: input.name,
        phone: input.phone,
        memo: input.memo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'actor_id' }
    );
  if (error) throw new Error(error.message);
}

/** 어드민 목록용 — 배우별 카카오 연결 여부와 프로필을 한 번에 가져온다. */
export async function listActorAccounts(
  actorIds?: string[]
): Promise<
  Map<string, { kakaoLinked: boolean; notifyReady: boolean; profile: ActorProfile | null }>
> {
  // 배우를 지정하면 그 범위만 읽는다 — 상세 화면 하나 때문에 전체를 읽지 않는다.
  const query = db().from('actor_accounts').select(ACCOUNT_COLS);
  const { data, error } = actorIds ? await query.in('actor_id', actorIds) : await query;
  if (error) throw new Error(error.message);

  const out = new Map<
    string,
    { kakaoLinked: boolean; notifyReady: boolean; profile: ActorProfile | null }
  >();
  for (const row of (data ?? []) as AccountRowShape[]) {
    out.set(row.actor_id, {
      kakaoLinked: Boolean(row.kakao_user_id),
      // 메시지 동의까지 받아야 알림을 보낼 수 있다 — 로그인만으로는 부족하다.
      notifyReady: Boolean(row.kakao_refresh_token) && row.notify_enabled,
      profile: toProfile(row),
    });
  }
  return out;
}
