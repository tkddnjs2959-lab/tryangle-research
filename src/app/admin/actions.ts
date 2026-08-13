'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPassword, createSession, destroySession, isLoggedIn } from '@/lib/admin-auth';
import { getActorAccountById, getActorKakaoRefreshToken, getActorNotificationToken, unlinkActorFromKakao } from '@/lib/actor-account';
import { refreshKakaoAccessToken, sendKakaoMemo, unlinkKakaoUser } from '@/lib/kakao-login';
import {
  archiveCoachingStudent,
  archiveConsultationSession,
  approveConsultationAnalysis,
  createActionItem,
  createConsultationSession,
  createActor,
  createCoachingStudent,
  deleteInquiry,
  deleteResponse,
  getActor,
  getActionItem,
  getConsultationAnalysis,
  getConsultationSession,
  listActionItems,
  linkActorToCoaching,
  listCohortWeeks,
  restoreResponse,
  rejectConsultationAnalysis,
  saveConsultationAnalysis,
  saveConsultationTranscript,
  updateActionItem,
  setActorWeekOverride,
  setCohortWeekOpen,
  setCohortWeekTitle,
  setInquiryStatus,
  setInquiryMemo,
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
import { analyzeConsultation } from '@/lib/consultation-analysis';
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

export async function unlinkActorKakao(formData: FormData) {
  await requireAdmin();
  const actorId = String(formData.get('actorId') ?? '');
  const actor = actorId ? await getActorAccountById(actorId) : null;
  if (!actor) return;
  let remoteUnlinked = false;
  const refreshToken = await getActorKakaoRefreshToken(actorId);
  if (refreshToken) {
    const refreshed = await refreshKakaoAccessToken(refreshToken);
    if (refreshed) remoteUnlinked = await unlinkKakaoUser(refreshed.accessToken);
  }
  await unlinkActorFromKakao(actorId);
  await audit({
    action: 'kakao_unlink',
    targetType: 'actor',
    targetId: actorId,
    summary: '배우 카카오 계정 연결을 해제했습니다.',
    detail: { operation: 'unlink', remoteUnlinked },
  });
  revalidatePath(`/admin/${actorId}`);
  revalidatePath('/admin');
  redirect(`/admin/${actorId}?kakao_unlink=${remoteUnlinked ? 'remote_ok' : 'local_only'}`);
}

export async function sendActorKakaoTest(formData: FormData) {
  await requireAdmin();
  const actorId = String(formData.get('actorId') ?? '');
  const actor = actorId ? await getActorAccountById(actorId) : null;
  if (!actor?.kakaoUserId) return;
  const refreshToken = await getActorNotificationToken(actorId);
  if (!refreshToken) {
    redirect(`/admin/${actorId}?kakao_test=not_ready`);
  }
  const refreshed = await refreshKakaoAccessToken(refreshToken);
  if (!refreshed) redirect(`/admin/${actorId}?kakao_test=failed`);
  const link = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/s/${actor.progressToken}` : null;
  const sent = await sendKakaoMemo({
    accessToken: refreshed.accessToken,
    text: '[TRY앵글] 카카오 알림 테스트\n\n주차 공개 알림 연결이 정상적으로 확인되었습니다.',
    linkUrl: link,
  });
  if (sent) {
    await audit({ action: 'kakao_test_message', targetType: 'actor', targetId: actorId, summary: '카카오 테스트 알림을 발송했습니다.', detail: { operation: 'test_message' } });
  }
  revalidatePath(`/admin/${actorId}`);
  redirect(`/admin/${actorId}?kakao_test=${sent ? 'sent' : 'failed'}`);
}

export async function saveInquiryMemo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const memo = String(formData.get('memo') ?? '');
  if (id) await setInquiryMemo(id, memo);
  revalidatePath('/admin/inquiries');
}

export async function createConsultation(form: FormData) {
  await requireAdmin();
  const actorId = String(form.get('actorId') ?? '');
  const consultedAt = String(form.get('consultedAt') ?? '');
  if (!actorId || !consultedAt || form.get('consent') !== 'on') return;
  if (!(await getActor(actorId))) return;
  const consultedDate = new Date(consultedAt);
  if (Number.isNaN(consultedDate.getTime())) return;
  const sourceValue = String(form.get('source') ?? 'manual');
  const source = ['manual', 'clova_note_import'].includes(sourceValue) ? sourceValue : 'manual';
  const file = form.get('transcriptFile');
  let transcript = String(form.get('transcript') ?? '').trim();
  if (!transcript && file instanceof File && file.size > 0) {
    if (file.size > 2_000_000 || (file.type && file.type !== 'text/plain')) return;
    transcript = (await file.text()).trim();
  }
  if (transcript.length > 500_000) return;
  const durationValue = Number(form.get('durationSeconds'));
  const durationSeconds = Number.isFinite(durationValue) && durationValue >= 0 ? Math.floor(durationValue) : null;
  const consultationTypeValue = String(form.get('consultationType') ?? 'general');
  const consultationType = ['general', 'profile', 'coaching', 'follow_up'].includes(consultationTypeValue) ? consultationTypeValue : 'general';
  const sessionId = await createConsultationSession({ actorId, consultedAt: consultedDate.toISOString(), consultationType, durationSeconds, counselorName: String(form.get('counselorName') ?? '').trim() || null, source, recordingPath: String(form.get('recordingPath') ?? '').trim() || null, consentObtainedAt: new Date().toISOString() });
  if (transcript) await saveConsultationTranscript({ sessionId, fullText: transcript });
  await audit({ action: 'consultation_create', targetType: 'actor', targetId: actorId, summary: '상담 세션을 등록했습니다.', detail: { sessionId, transcriptSaved: Boolean(transcript), source } });
  if (transcript) await audit({ action: 'consultation_transcript_save', targetType: 'consultation_session', targetId: sessionId, summary: '상담 원문을 저장했습니다.' });
  revalidatePath(`/admin/${actorId}`);
}

export async function runConsultationAnalysis(form: FormData) {
  await requireAdmin();
  const sessionId = String(form.get('sessionId') ?? '');
  const session = await getConsultationSession(sessionId);
  if (!session?.transcript || session.status === 'archived') return;
  const actor = await getActor(session.actorId);
  if (!actor) return;
  const existing = session.analyses.reduce((max, a) => Math.max(max, a.analysisVersion), 0);
  let result: Awaited<ReturnType<typeof analyzeConsultation>>;
  try {
    result = await analyzeConsultation({ text: session.transcript.fullText, actorName: actor.name });
  } catch {
    await saveConsultationAnalysis({ sessionId, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', promptVersion: 'v1', analysisVersion: existing + 1, summary: 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', structuredResult: { error: 'analysis_failed' }, inputHash: 'unavailable', tokenUsage: null, status: 'failed' });
    await audit({ action: 'consultation_analysis_run', targetType: 'consultation_session', targetId: sessionId, summary: '상담 AI 분석에 실패했습니다.' });
    revalidatePath(`/admin/${session.actorId}`);
    return;
  }
  if (!result.configured) {
    await saveConsultationAnalysis({ sessionId, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', promptVersion: 'v1', analysisVersion: existing + 1, summary: 'DeepSeek API 키가 설정되지 않아 분석하지 못했습니다.', structuredResult: { error: 'not_configured' }, inputHash: result.hash, tokenUsage: null, status: 'failed' });
  } else {
      await saveConsultationAnalysis({ sessionId, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', promptVersion: 'v1', analysisVersion: existing + 1, summary: typeof result.structured.summary === 'string' ? result.structured.summary : null, structuredResult: result.structured, inputHash: result.hash, tokenUsage: result.usage });
  }
  await audit({ action: 'consultation_analysis_run', targetType: 'consultation_session', targetId: sessionId, summary: '상담 AI 분석을 실행했습니다.' });
  revalidatePath(`/admin/${session.actorId}`);
}

export async function reviewConsultationAnalysis(form: FormData) {
  await requireAdmin();
  const id = String(form.get('analysisId') ?? ''); const status = String(form.get('status') ?? '');
  if (!id || !['approved', 'rejected'].includes(status)) return;
  const sessionId = String(form.get('sessionId') ?? '');
  const analysis = await getConsultationAnalysis(id);
  if (!analysis || analysis.session_id !== sessionId || analysis.status !== 'pending') return;
  const sessionForReview = await getConsultationSession(sessionId);
  if (!sessionForReview || sessionForReview.status === 'archived') return;
  if (status === 'approved') {
    await approveConsultationAnalysis(id);
    // AI 제안은 관리자가 승인한 뒤에만 후속 조치로 승격한다.
    const structured = analysis.structured_result;
    const agreed = structured && typeof structured === 'object' && !Array.isArray(structured) &&
      Array.isArray((structured as { agreed_actions?: unknown }).agreed_actions)
      ? (structured as { agreed_actions: unknown[] }).agreed_actions : [];
    if (sessionForReview) {
      const existingItems = await listActionItems(sessionForReview.actorId);
      for (const raw of agreed) {
        const title = typeof raw === 'string' ? raw.trim() :
          (raw && typeof raw === 'object' && 'title' in raw ? String((raw as { title?: unknown }).title ?? '').trim() : '');
        if (title && !existingItems.some((item) => item.title === title && item.status !== 'cancelled')) {
          await createActionItem({ sessionId, actorId: sessionForReview.actorId, title });
        }
      }
    }
  } else {
    await rejectConsultationAnalysis(id);
  }
  const session = await getConsultationSession(sessionId);
  await audit({ action: 'consultation_analysis_review', targetType: 'consultation_session', targetId: sessionId, summary: status === 'approved' ? 'AI 분석을 승인했습니다.' : 'AI 분석을 거절했습니다.', detail: { analysisId: id, status } });
  if (session) revalidatePath(`/admin/${session.actorId}`);
}

export async function addConsultationActionItem(form: FormData) {
  await requireAdmin();
  const sessionId = String(form.get('sessionId') ?? ''); const title = String(form.get('title') ?? '').trim();
  const session = await getConsultationSession(sessionId);
  if (!session || session.status === 'archived' || !title || title.length > 300) return;
  const dueAtValue = String(form.get('dueAt') ?? '').trim();
  // HTML date inputs are user-controlled; reject malformed values before they
  // reach the timestamptz column (an invalid value would otherwise abort the
  // entire server action).
  const dueAt = dueAtValue ? new Date(`${dueAtValue}T00:00:00.000Z`) : null;
  if (dueAtValue && Number.isNaN(dueAt!.getTime())) return;
  const actorId = session.actorId;
  const description = String(form.get('description') ?? '').trim();
  const assignee = String(form.get('assignee') ?? '').trim();
  if (description.length > 5000 || assignee.length > 200) return;
  await createActionItem({ sessionId, actorId, title, description: description || null, assignee: assignee || null, dueAt: dueAt ? dueAt.toISOString() : null });
  await audit({ action: 'consultation_action_update', targetType: 'actor', targetId: actorId, summary: '상담 후속 조치를 추가했습니다.' });
  revalidatePath(`/admin/${actorId}`);
}

export async function completeConsultationActionItem(form: FormData) {
  await requireAdmin(); const id = String(form.get('actionItemId') ?? '');
  const item = id ? await getActionItem(id) : null;
  if (!item || item.status === 'done' || item.status === 'cancelled') return;
  const session = await getConsultationSession(item.session_id as string);
  if (!session || session.status === 'archived') return;
  const actorId = item.actor_id as string;
  await updateActionItem(id, { status: 'done' });
  await audit({ action: 'consultation_action_update', targetType: 'actor', targetId: actorId, summary: '상담 후속 조치를 완료했습니다.', detail: { actionItemId: id } });
  if (actorId) revalidatePath(`/admin/${actorId}`);
}

export async function archiveConsultation(form: FormData) {
  await requireAdmin(); const sessionId = String(form.get('sessionId') ?? '');
  const session = await getConsultationSession(sessionId);
  if (!session) return;
  const actorId = session.actorId;
  await archiveConsultationSession(sessionId);
  await audit({ action: 'consultation_archive', targetType: 'consultation_session', targetId: sessionId, summary: '상담 세션을 보관했습니다.' });
  if (actorId) revalidatePath(`/admin/${actorId}`);
}
