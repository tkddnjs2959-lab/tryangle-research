'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getActorAccountById, updateActorProfile } from '@/lib/actor-account';
import { destroyActorSession, getActorSession } from '@/lib/actor-session';

export async function saveActorProfile(_prev: string | null, form: FormData): Promise<string | null> {
  const session = await getActorSession();
  if (!session) return '로그인이 필요합니다.';

  const account = await getActorAccountById(session.actorId);
  if (!account || account.kakaoUserId !== session.kakaoUserId) return '로그인 정보가 올바르지 않습니다.';

  const name = String(form.get('name') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim();
  const memo = String(form.get('memo') ?? '').trim();

  if (!name) return '이름을 입력해주세요.';
  if (!phone) return '연락처를 입력해주세요.';

  await updateActorProfile({ actorId: account.id, name, phone, memo });
  revalidatePath('/actor');
  return null;
}

export async function logoutActor() {
  await destroyActorSession();
  redirect('/actor');
}
