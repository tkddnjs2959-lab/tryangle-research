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
  setActorWeekOverride,
  setCohortWeekOpen,
  setCohortWeekTitle,
  setInquiryStatus,
  setSurveyLock,
  updateCoachingStudentNote,
  type InquiryStatus,
} from '@/lib/admin-data';
import { db } from '@/lib/supabase';
import type { Category, Gender } from '@/lib/types';
import { WEEK_COUNT } from '@/lib/weeks';

async function requireAdmin() {
  if (!(await isLoggedIn())) redirect('/admin/login');
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const pw = String(form.get('password') ?? '');
  if (!pw) return '비밀번호를 입력해주세요.';
  if (!checkPassword(pw)) return '비밀번호가 올바르지 않습니다.';
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

  await createActor({ name, birthYear, gender, cohort });
  revalidatePath('/admin');
  return null;
}

export async function removeResponse(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('responseId') ?? '');
  const actorId = String(formData.get('actorId') ?? '');
  if (id) await deleteResponse(id);
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
  revalidatePath('/admin');
  revalidatePath(`/admin/cohort/${encodeURIComponent(cohort)}`);
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
