import 'server-only';
import { db } from './supabase';
import type { Gender } from './types';

const KAKAO_ID_RE = /^\[\[kakao_user_id:([^\]]+)\]\]$/m;
const PROFILE_RE = /^\[\[actor_profile:(.+)\]\]$/m;

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

function parseKakaoUserId(note: string | null): string | null {
  return note?.match(KAKAO_ID_RE)?.[1] ?? null;
}

function parseProfile(note: string | null): ActorProfile | null {
  const raw = note?.match(PROFILE_RE)?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActorProfile>;
    return {
      name: String(parsed.name ?? ''),
      phone: String(parsed.phone ?? ''),
      memo: String(parsed.memo ?? ''),
      kakaoNickname: parsed.kakaoNickname ?? null,
      updatedAt: String(parsed.updatedAt ?? ''),
    };
  } catch {
    return null;
  }
}

function withoutManagedMarkers(note: string | null): string {
  return String(note ?? '')
    .split('\n')
    .filter((line) => !KAKAO_ID_RE.test(line.trim()) && !PROFILE_RE.test(line.trim()))
    .join('\n')
    .trim();
}

function composeNote(note: string | null, kakaoUserId: string | null, profile: ActorProfile | null) {
  const lines = [withoutManagedMarkers(note)];
  if (kakaoUserId) lines.push(`[[kakao_user_id:${kakaoUserId}]]`);
  if (profile) lines.push(`[[actor_profile:${JSON.stringify(profile)}]]`);
  return lines.filter(Boolean).join('\n') || null;
}

function toAccount(row: {
  id: string;
  name: string;
  birth_year: number | null;
  gender: Gender;
  cohort: string | null;
  progress_token: string;
  note: string | null;
}): ActorAccount {
  return {
    id: row.id,
    name: row.name,
    birthYear: row.birth_year,
    gender: row.gender,
    cohort: row.cohort,
    progressToken: row.progress_token,
    kakaoUserId: parseKakaoUserId(row.note),
    profile: parseProfile(row.note),
  };
}

export async function getActorAccountByProgressToken(token: string): Promise<ActorAccount | null> {
  const { data, error } = await db()
    .from('actors')
    .select('id, name, birth_year, gender, cohort, progress_token, note')
    .eq('progress_token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAccount(data as Parameters<typeof toAccount>[0]) : null;
}

export async function getActorAccountById(id: string): Promise<ActorAccount | null> {
  const { data, error } = await db()
    .from('actors')
    .select('id, name, birth_year, gender, cohort, progress_token, note')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAccount(data as Parameters<typeof toAccount>[0]) : null;
}

export async function findActorAccountByKakaoUserId(kakaoUserId: string): Promise<ActorAccount | null> {
  const { data, error } = await db()
    .from('actors')
    .select('id, name, birth_year, gender, cohort, progress_token, note')
    .ilike('note', `%[[kakao_user_id:${kakaoUserId}]]%`)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? toAccount(row as Parameters<typeof toAccount>[0]) : null;
}

export async function linkActorToKakao(input: {
  actorId: string;
  kakaoUserId: string;
  kakaoNickname?: string | null;
}) {
  const account = await getActorAccountById(input.actorId);
  if (!account) throw new Error('배우를 찾을 수 없습니다.');

  const profile = account.profile
    ? { ...account.profile, kakaoNickname: input.kakaoNickname ?? account.profile.kakaoNickname ?? null }
    : null;

  const { data: current, error: readError } = await db()
    .from('actors')
    .select('note')
    .eq('id', input.actorId)
    .single();
  if (readError) throw new Error(readError.message);

  const nextNote = composeNote(current.note, input.kakaoUserId, profile);
  const { error } = await db().from('actors').update({ note: nextNote }).eq('id', input.actorId);
  if (error) throw new Error(error.message);
}

export async function updateActorProfile(input: {
  actorId: string;
  name: string;
  phone: string;
  memo: string;
}) {
  const account = await getActorAccountById(input.actorId);
  if (!account) throw new Error('배우를 찾을 수 없습니다.');

  const { data: current, error: readError } = await db()
    .from('actors')
    .select('note')
    .eq('id', input.actorId)
    .single();
  if (readError) throw new Error(readError.message);

  const profile: ActorProfile = {
    name: input.name,
    phone: input.phone,
    memo: input.memo,
    kakaoNickname: account.profile?.kakaoNickname ?? null,
    updatedAt: new Date().toISOString(),
  };
  const nextNote = composeNote(current.note, account.kakaoUserId, profile);
  const { error } = await db().from('actors').update({ note: nextNote }).eq('id', input.actorId);
  if (error) throw new Error(error.message);
}
