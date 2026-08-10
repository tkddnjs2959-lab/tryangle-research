'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPassword, createSession, destroySession, isLoggedIn } from '@/lib/admin-auth';
import {
  archiveCoachingStudent,
  createActor,
  createCoachingStudent,
  deleteInquiry,
  deleteResponse,
  getActor,
  linkActorToCoaching,
  listCohortWeeks,
  restoreResponse,
  setActorWeekOverride,
  setCohortWeekOpen,
  setCohortWeekTitle,
  setInquiryStatus,
  setSurveyLock,
  unlinkCoachingStudent,
  updateCoachingStudentNote,
  type InquiryStatus,
} from '@/lib/admin-data';
import { listActorIdsInCohort, notifyActorsWeekOpen } from '@/lib/actor-notify';
import { audit } from '@/lib/audit';
import {
  clearFailures,
  clientIp,
  humanizeSeconds,
  lockedSeconds,
  recordFailure,
} from '@/lib/login-throttle';
import { db } from '@/lib/supabase';
import type { Category, Gender } from '@/lib/types';
import { WEEK_COUNT } from '@/lib/weeks';

async function requireAdmin() {
  if (!(await isLoggedIn())) redirect('/admin/login');
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const pw = String(form.get('password') ?? '');
  if (!pw) return '비밀번호를 입력해주세요.';

  // 공개 배포된 로그인 화면이라 대입 공격을 시도 제한으로 막는다.
  const ip = await clientIp();
  const locked = await lockedSeconds(ip);
  if (locked !== null) {
    return `로그인 시도가 너무 많습니다. ${humanizeSeconds(locked)} 후에 다시 시도해주세요.`;
  }

  if (!checkPassword(pw)) {
    const lockedFor = await recordFailure(ip);
    if (lockedFor !== null) {
      return `비밀번호를 여러 번 틀렸습니다. ${humanizeSeconds(lockedFor)} 동안 잠깁니다.`;
    }
    return '비밀번호가 올바르지 않습니다.';
  }

  await clearFailures(ip);
  await createSession();
  redirect('/admin');
}

export async function logout() {
  await destroySession();
  redirect('/admin/login');
}

export async function addActor(_prev: string | null, form: FormData): Promise<string | null> {
  await requireAdmin();

  const name = String(form.get('name') ?? '').trim();
  if (!name) return '이름을 입력해주세요.';

  const birthRaw = String(form.get('birthYear') ?? '').trim();
  const birthYear = birthRaw ? Number(birthRaw) : null;
  if (birthRaw && (!Number.isInteger(birthYear) || birthYear! < 1900 || birthYear! > 2100)) {
    return '출생년도는 1900~2100 사이 숫자로 입력해주세요.';
  }

  const gender = (String(form.get('gender') ?? 'female') as Gender);
  const cohort = String(form.get('cohort') ?? '').trim() || null;

  const newId = await createActor({ name, birthYear, gender, cohort });
  await audit({
    action: 'actor_create',
    targetType: 'actor',
    targetId: newId,
    summary: `배우 ${name}${cohort ? ` (${cohort})` : ''}를 등록했습니다.`,
  });
  revalidatePath('/admin');
  return null;
}

export async function removeResponse(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('responseId') ?? '');
  const actorId = String(formData.get('actorId') ?? '');
  const label = String(formData.get('label') ?? '응답');
  if (id) {
    await deleteResponse(id);
    await audit({
      action: 'response_delete',
      targetType: 'actor',
      targetId: actorId,
      summary: `${label}을(를) 삭제했습니다. 복구할 수 있습니다.`,
      detail: { responseId: id },
    });
  }
  revalidatePath(`/admin/${actorId}`);
}

export async function undoRemoveResponse(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('responseId') ?? '');
  const actorId = String(formData.get('actorId') ?? '');
  if (id) {
    await restoreResponse(id);
    await audit({
      action: 'response_restore',
      targetType: 'actor',
      targetId: actorId,
      summary: '삭제한 응답을 복구했습니다.',
      detail: { responseId: id },
    });
  }
  revalidatePath(`/admin/${actorId}`);
}

export async function toggleLock(formData: FormData) {
  await requireAdmin();
  const actorId = String(formData.get('actorId') ?? '');
  const type = String(formData.get('type') ?? '') as Category;
  const locked = String(formData.get('locked') ?? '') === 'true';
  await setSurveyLock(actorId, type, locked);
  revalidatePath(`/admin/${actorId}`);
}

// ---------------------------------------------------------------------
// 기수별 1~12주차 공개
// ---------------------------------------------------------------------

function parseWeek(raw: FormDataEntryValue | null): number | null {
  const week = Number(String(raw ?? ''));
  return Number.isInteger(week) && week >= 1 && week <= WEEK_COUNT ? week : null;
}

/** 기수 전체 공개/비공개 */
export async function toggleCohortWeek(formData: FormData) {
  await requireAdmin();
  const cohort = String(formData.get('cohort') ?? '').trim();
  const week = parseWeek(formData.get('week'));
  const open = String(formData.get('open') ?? '') === 'true';
  if (!cohort || week === null) return;

  await setCohortWeekOpen(cohort, week, open);

  const path = `/admin/cohort/${encodeURIComponent(cohort)}`;

  // 공개할 때만 알린다. 닫는 것은 알리지 않는다.
  // 알림 실패는 공개 자체를 되돌리지 않는다 — 공개는 이미 반영된 사실이다.
  if (open) {
    const weeks = await listCohortWeeks(cohort);
    const title = weeks.find((w) => w.week === week)?.title ?? null;
    const actorIds = await listActorIdsInCohort(cohort);
    const result = await notifyActorsWeekOpen({ actorIds, week, title });

    await audit({
      action: 'week_open',
      targetType: 'cohort',
      targetId: cohort,
      summary: `${cohort} ${week}주차를 기수 전체에 공개했습니다. 알림 ${result.sent}명 발송.`,
      detail: { week, ...result },
    });

    revalidatePath('/admin');
    revalidatePath(path);
    // 몇 명에게 갔는지 화면에서 알 수 있어야 한다 — 결과를 쿼리로 넘긴다.
    redirect(`${path}?${notifyParams(week, result)}`);
  }

  await audit({
    action: 'week_close',
    targetType: 'cohort',
    targetId: cohort,
    summary: `${cohort} ${week}주차를 비공개로 되돌렸습니다.`,
    detail: { week },
  });

  revalidatePath('/admin');
  revalidatePath(path);
}

/** 발송 결과를 주소창으로 넘기기 위한 쿼리 문자열 */
function notifyParams(week: number, r: { sent: number; skipped: number; failed: number }) {
  return new URLSearchParams({
    nweek: String(week),
    nsent: String(r.sent),
    nskip: String(r.skipped),
    nfail: String(r.failed),
  }).toString();
}

export async function saveCohortWeekTitle(formData: FormData) {
  await requireAdmin();
  const cohort = String(formData.get('cohort') ?? '').trim();
  const week = parseWeek(formData.get('week'));
  const title = String(formData.get('title') ?? '');
  if (!cohort || week === null) return;

  await setCohortWeekTitle(cohort, week, title);
  revalidatePath(`/admin/cohort/${encodeURIComponent(cohort)}`);
}

/**
 * 배우별 예외.
 * mode 가 'follow' 면 예외를 지워서 기수 설정을 다시 따르게 한다.
 */
export async function setActorWeek(formData: FormData) {
  await requireAdmin();
  const actorId = String(formData.get('actorId') ?? '');
  const week = parseWeek(formData.get('week'));
  const mode = String(formData.get('mode') ?? '');
  if (!actorId || week === null) return;

  const override = mode === 'open' ? true : mode === 'close' ? false : null;
  await setActorWeekOverride(actorId, week, override);

  await audit({
    action: 'week_override',
    targetType: 'actor',
    targetId: actorId,
    summary:
      mode === 'open'
        ? `${week}주차를 이 배우에게만 공개했습니다.`
        : mode === 'close'
          ? `${week}주차를 이 배우에게만 비공개로 했습니다.`
          : `${week}주차를 기수 설정을 따르도록 되돌렸습니다.`,
    detail: { week, mode },
  });

  if (mode === 'open') {
    const actor = await getActor(actorId);
    const weeks = actor?.cohort ? await listCohortWeeks(actor.cohort) : [];
    const title = weeks.find((w) => w.week === week)?.title ?? null;
    const result = await notifyActorsWeekOpen({ actorIds: [actorId], week, title });

    revalidatePath('/admin');
    revalidatePath(`/admin/${actorId}`);
    redirect(`/admin/${actorId}?${notifyParams(week, result)}`);
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/${actorId}`);
}

export async function archiveActor(formData: FormData) {
  await requireAdmin();
  const actorId = String(formData.get('actorId') ?? '');
  await db().from('actors').update({ status: 'archived' }).eq('id', actorId);
  revalidatePath('/admin');
  redirect('/admin');
}

export async function changeInquiryStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as InquiryStatus;
  if (id && status) await setInquiryStatus(id, status);
  revalidatePath('/admin/inquiries');
}

export async function removeInquiry(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (id) await deleteInquiry(id);
  revalidatePath('/admin/inquiries');
}

export async function addCoachingStudent(_prev: string | null, form: FormData): Promise<string | null> {
  await requireAdmin();

  const name = String(form.get('name') ?? '').trim();
  if (!name) return '이름을 입력해주세요.';

  const birthRaw = String(form.get('birthYear') ?? '').trim();
  const birthYear = birthRaw ? Number(birthRaw) : null;
  if (birthRaw && (!Number.isInteger(birthYear) || birthYear! < 1900 || birthYear! > 2100)) {
    return '출생년도는 1900~2100 사이 숫자로 입력해주세요.';
  }

  const gender = (String(form.get('gender') ?? 'female') as Gender);
  const contact = String(form.get('contact') ?? '').trim() || null;

  await createCoachingStudent({ name, birthYear, gender, contact });
  revalidatePath('/admin/coaching');
  return null;
}

export async function saveCoachingNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const note = String(formData.get('note') ?? '');
  if (id) await updateCoachingStudentNote(id, note);
  revalidatePath('/admin/coaching');
}

/**
 * 퍼스널 브랜딩 배우를 1:1 코칭으로 넘긴다.
 * 이미 연동돼 있으면 새로 만들지 않고 그 학생으로 이동한다.
 */
export async function sendActorToCoaching(formData: FormData) {
  await requireAdmin();
  const actorId = String(formData.get('actorId') ?? '');
  if (!actorId) return;

  await linkActorToCoaching(actorId);
  await audit({
    action: 'coaching_link',
    targetType: 'actor',
    targetId: actorId,
    summary: '1:1 코칭 트랙으로 연동했습니다.',
  });
  revalidatePath('/admin/coaching');
  revalidatePath(`/admin/${actorId}`);
  redirect('/admin/coaching');
}

export async function unlinkCoaching(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (id) {
    await unlinkCoachingStudent(id);
    await audit({
      action: 'coaching_unlink',
      targetType: 'coaching_student',
      targetId: id,
      summary: '퍼스널 브랜딩 연동을 해제했습니다. 코칭 기록은 남아 있습니다.',
    });
  }
  revalidatePath('/admin/coaching');
}

export async function removeCoachingStudent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (id) await archiveCoachingStudent(id);
  revalidatePath('/admin/coaching');
}

/** 확정 스냅샷 — 렌더 설정을 통째로 남겨 나중에 그대로 재현한다 */
export async function saveSnapshot(input: {
  actorId: string;
  kind: 'bubble_image' | 'bubble_personality' | 'report';
  config: unknown;
}) {
  await requireAdmin();
  const { error } = await db().from('snapshots').insert({
    actor_id: input.actorId,
    kind: input.kind,
    config: input.config,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${input.actorId}`);
}
