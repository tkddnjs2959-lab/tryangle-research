import 'server-only';
import { listActorAccounts, type ActorProfile } from './actor-account';
import { createLeadReference } from './lead-reference';
import { db } from './supabase';
import type { Category, Gender } from './types';
import {
  DEFAULT_WEEK_TITLE,
  WEEKS,
  resolveWeekOpen,
  weekSource,
  type ActorWeek,
  type CohortWeek,
} from './weeks';

export type ActorRow = {
  id: string;
  name: string;
  birthYear: number | null;
  gender: Gender;
  cohort: string | null;
  status: string;
  progressToken: string;
  /** 배우에게 실제로 열려 있는 주차 번호 (기수 공개 + 배우별 예외를 합친 결과) */
  openWeeks: number[];
  kakaoLinked: boolean;
  /** 카카오 메시지 동의까지 받아 주차 공개 알림을 보낼 수 있는 상태 */
  notifyReady: boolean;
  /** refresh token 만료·철회 등으로 배우의 재연결이 필요한 상태 */
  notifyNeedsReconnect: boolean;
  actorProfile: ActorProfile | null;
  createdAt: string;
  surveys: { type: Category; token: string; n: number; minN: number; met: boolean; isOpen: boolean }[];
};

const ORDER: Category[] = ['image', 'personality', 'self'];

const ACTOR_SELECT = 'id, name, birth_year, gender, cohort, status, progress_token, note, created_at';

type RawActor = {
  id: string;
  name: string;
  birth_year: number | null;
  gender: Gender;
  cohort: string | null;
  status: string;
  progress_token: string;
  created_at: string;
};

/**
 * 배우 행에 진행 현황·주차·계정을 붙인다.
 *
 * 배우 몇 명이든 **딸린 조회는 항상 4번**이고, 넘겨받은 배우 범위로만 좁혀서 읽는다.
 * 배우 한 명을 보려고 전체를 읽던 예전 구조를 여기로 모았다.
 */
async function buildActorRows(actors: RawActor[]): Promise<ActorRow[]> {
  if (!actors.length) return [];

  const supabase = db();
  const ids = actors.map((a) => a.id);
  const cohorts = [...new Set(actors.map((a) => a.cohort).filter((c): c is string => Boolean(c)))];

  const [{ data: progress }, { data: cohortWeeks }, { data: overrides }, accounts] =
    await Promise.all([
      supabase
        .from('survey_progress')
        .select('actor_id, type, token, n, min_n, met, is_open')
        .in('actor_id', ids),
      cohorts.length
        ? supabase.from('cohort_weeks').select('cohort, week').eq('is_open', true).in('cohort', cohorts)
        : Promise.resolve({ data: [] as { cohort: string; week: number }[] }),
      supabase.from('actor_week_overrides').select('actor_id, week, is_open').in('actor_id', ids),
      listActorAccounts(ids),
    ]);

  // 기수 공개 주차 → 배우별 예외 순으로 덮어써서 배우마다 열린 주차를 구한다.
  const openByCohort = new Map<string, Set<number>>();
  for (const r of cohortWeeks ?? []) {
    const key = r.cohort as string;
    if (!openByCohort.has(key)) openByCohort.set(key, new Set());
    openByCohort.get(key)!.add(r.week as number);
  }
  const overrideByActor = new Map<string, Map<number, boolean>>();
  for (const o of overrides ?? []) {
    const key = o.actor_id as string;
    if (!overrideByActor.has(key)) overrideByActor.set(key, new Map());
    overrideByActor.get(key)!.set(o.week as number, o.is_open as boolean);
  }

  return actors.map((a) => ({
    id: a.id,
    name: a.name,
    birthYear: a.birth_year,
    gender: a.gender,
    cohort: a.cohort,
    status: a.status,
    progressToken: a.progress_token,
    openWeeks: WEEKS.filter((w) =>
      resolveWeekOpen(
        Boolean(a.cohort && openByCohort.get(a.cohort)?.has(w)),
        overrideByActor.get(a.id)?.has(w) ? overrideByActor.get(a.id)!.get(w)! : null
      )
    ),
    kakaoLinked: accounts.get(a.id)?.kakaoLinked ?? false,
    notifyReady: accounts.get(a.id)?.notifyReady ?? false,
    notifyNeedsReconnect: accounts.get(a.id)?.notifyNeedsReconnect ?? false,
    actorProfile: accounts.get(a.id)?.profile ?? null,
    createdAt: a.created_at,
    surveys: (progress ?? [])
      .filter((p) => p.actor_id === a.id)
      .map((p) => ({
        type: p.type as Category,
        token: p.token as string,
        n: p.n as number,
        minN: p.min_n as number,
        met: p.met as boolean,
        isOpen: p.is_open as boolean,
      }))
      .sort((x, y) => ORDER.indexOf(x.type) - ORDER.indexOf(y.type)),
  }));
}

export async function listActors(): Promise<ActorRow[]> {
  const { data } = await db()
    .from('actors')
    .select(ACTOR_SELECT)
    .order('created_at', { ascending: false });

  return buildActorRows((data ?? []) as RawActor[]);
}

/** 배우 한 명만 읽는다 — 예전에는 전체 목록을 불러 그중 하나를 찾았다. */
export async function getActor(id: string): Promise<ActorRow | null> {
  const { data } = await db().from('actors').select(ACTOR_SELECT).eq('id', id).maybeSingle();
  if (!data) return null;

  const rows = await buildActorRows([data as RawActor]);
  return rows[0] ?? null;
}

export async function listActorsByIds(ids: string[]): Promise<ActorRow[]> {
  if (ids.length === 0) return [];
  const { data } = await db().from('actors').select(ACTOR_SELECT).in('id', ids);
  return buildActorRows((data ?? []) as RawActor[]);
}

export type ResponseRow = {
  id: string;
  submittedAt: string;
  deviceHash: string | null;
  deletedAt: string | null;
  labels: string[];
};

/**
 * 어드민만 볼 수 있는 개별 응답. 배우에게는 절대 노출하지 않는다.
 *
 * 기본은 살아있는 응답만. `includeDeleted` 를 켜면 지운 것도 함께 준다
 * (복구 화면용). 집계 함수들은 이 옵션을 쓰지 않는다.
 */
export async function listResponses(
  actorId: string,
  type: Category,
  includeDeleted = false
): Promise<ResponseRow[]> {
  const supabase = db();

  const { data: survey } = await supabase
    .from('surveys')
    .select('id')
    .eq('actor_id', actorId)
    .eq('type', type)
    .maybeSingle();

  if (!survey) return [];

  let query = supabase
    .from('responses')
    .select('id, submitted_at, device_hash, deleted_at, response_keywords(custom_label, keywords(label))')
    .eq('survey_id', survey.id);

  if (!includeDeleted) query = query.is('deleted_at', null);

  const { data } = await query.order('submitted_at', { ascending: true });

  return (data ?? []).map((r) => {
    const rks = (r.response_keywords ?? []) as {
      custom_label: string | null;
      keywords: { label: string } | { label: string }[] | null;
    }[];
    return {
      id: r.id,
      submittedAt: r.submitted_at,
      deviceHash: r.device_hash,
      deletedAt: r.deleted_at ?? null,
      labels: rks.map((rk) => {
        const k = Array.isArray(rk.keywords) ? rk.keywords[0] : rk.keywords;
        return k?.label ?? rk.custom_label ?? '';
      }).filter(Boolean),
    };
  });
}

export type AggregateItem = { label: string; raw: number; isCustom: boolean };

/**
 * 집계.
 * 말풍선 렌더러가 쓰는 원자료 — 응답자 수와 키워드별 체크 수만 넘긴다.
 */
export async function aggregate(
  actorId: string,
  type: Category
): Promise<{ items: AggregateItem[]; n: number }> {
  const responses = await listResponses(actorId, type);
  const counts = new Map<string, { raw: number; isCustom: boolean }>();

  const supabase = db();
  const { data: known } = await supabase.from('keywords').select('label');
  const knownSet = new Set((known ?? []).map((k) => k.label as string));

  for (const r of responses) {
    for (const label of new Set(r.labels)) {
      const cur = counts.get(label) ?? { raw: 0, isCustom: !knownSet.has(label) };
      cur.raw += 1;
      counts.set(label, cur);
    }
  }

  const items = [...counts.entries()]
    .map(([label, v]) => ({ label, raw: v.raw, isCustom: v.isCustom }))
    .sort((a, b) => b.raw - a.raw || a.label.localeCompare(b.label, 'ko'));

  return { items, n: responses.length };
}

/** 셀프 체크에서 배우가 고른 키워드 (분류별) */
export async function getSelfPicks(
  actorId: string
): Promise<{ image: string[]; personality: string[] }> {
  const supabase = db();

  const { data: survey } = await supabase
    .from('surveys')
    .select('id')
    .eq('actor_id', actorId)
    .eq('type', 'self')
    .maybeSingle();

  if (!survey) return { image: [], personality: [] };

  const { data } = await supabase
    .from('responses')
    .select('response_keywords(custom_label, keywords(label, category))')
    .eq('survey_id', survey.id);

  const out = { image: [] as string[], personality: [] as string[] };
  for (const r of data ?? []) {
    const rks = (r.response_keywords ?? []) as {
      custom_label: string | null;
      keywords: { label: string; category: string } | { label: string; category: string }[] | null;
    }[];
    for (const rk of rks) {
      const k = Array.isArray(rk.keywords) ? rk.keywords[0] : rk.keywords;
      if (k?.category === 'image') out.image.push(k.label);
      else if (k?.category === 'personality') out.personality.push(k.label);
    }
  }
  return out;
}

export async function createActor(input: {
  name: string;
  birthYear: number | null;
  gender: Gender;
  cohort: string | null;
}) {
  const { data, error } = await db()
    .from('actors')
    .insert({
      name: input.name,
      birth_year: input.birthYear,
      gender: input.gender,
      cohort: input.cohort,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * 응답 삭제 — 실제로 지우지 않고 deleted_at 만 찍는다.
 * survey_progress 뷰와 submit_response 가 deleted_at is null 만 세므로
 * 집계에서는 즉시 빠진다.
 */
export async function deleteResponse(id: string) {
  const { error } = await db()
    .from('responses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function restoreResponse(id: string) {
  const { error } = await db().from('responses').update({ deleted_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setSurveyLock(actorId: string, type: Category, locked: boolean) {
  const { error } = await db()
    .from('surveys')
    .update({ locked })
    .eq('actor_id', actorId)
    .eq('type', type);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// 기수별 1~12주차 공개 관리
//
// 공개 판정은 두 단계다 — 기수 단위(cohort_weeks)로 열고, 배우별 예외
// (actor_week_overrides)가 있으면 그쪽이 이긴다. 판정 규칙 자체는 weeks.ts 에 있다.
// ---------------------------------------------------------------------

/** 한 기수의 1~12주차. 행이 없는 주차는 '제목 없음 · 비공개' 로 채워서 항상 12개를 준다. */
export async function listCohortWeeks(cohort: string): Promise<CohortWeek[]> {
  const { data, error } = await db()
    .from('cohort_weeks')
    .select('week, title, is_open, opened_at')
    .eq('cohort', cohort);

  if (error) throw new Error(error.message);

  const byWeek = new Map((data ?? []).map((r) => [r.week as number, r]));
  return WEEKS.map((week) => {
    const row = byWeek.get(week);
    return {
      week,
      title: (row?.title as string | null) ?? DEFAULT_WEEK_TITLE[week] ?? null,
      isOpen: Boolean(row?.is_open),
      openedAt: (row?.opened_at as string | null) ?? null,
    };
  });
}

/** 어드민 목록에서 기수별 공개 현황을 한 번에 뽑을 때 쓴다. */
export async function listOpenWeekCountByCohort(): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('cohort_weeks')
    .select('cohort, week')
    .eq('is_open', true);

  if (error) throw new Error(error.message);

  const out = new Map<string, number>();
  for (const r of data ?? []) {
    const key = r.cohort as string;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

export async function setCohortWeekTitle(cohort: string, week: number, title: string) {
  const clean = title.trim();
  const { error } = await db()
    .from('cohort_weeks')
    .upsert(
      { cohort, week, title: clean || null, updated_at: new Date().toISOString() },
      { onConflict: 'cohort,week' }
    );
  if (error) throw new Error(error.message);
}

export async function setCohortWeekOpen(cohort: string, week: number, open: boolean) {
  const { error } = await db()
    .from('cohort_weeks')
    .upsert(
      {
        cohort,
        week,
        is_open: open,
        opened_at: open ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cohort,week' }
    );
  if (error) throw new Error(error.message);
}

/**
 * 배우 한 명의 1~12주차 상태.
 * 기수가 없는 배우는 기수 공개가 없으므로 예외로만 열린다.
 */
export async function listActorWeeks(
  actorId: string,
  cohort: string | null
): Promise<ActorWeek[]> {
  const supabase = db();

  const [cohortWeeks, overrides] = await Promise.all([
    cohort ? listCohortWeeks(cohort) : Promise.resolve<CohortWeek[]>([]),
    supabase
      .from('actor_week_overrides')
      .select('week, is_open')
      .eq('actor_id', actorId)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data ?? [];
      }),
  ]);

  const cohortByWeek = new Map(cohortWeeks.map((w) => [w.week, w]));
  const overrideByWeek = new Map(
    overrides.map((o) => [o.week as number, o.is_open as boolean])
  );

  return WEEKS.map((week) => {
    const cw = cohortByWeek.get(week);
    const cohortOpen = cw?.isOpen ?? false;
    const override = overrideByWeek.has(week) ? overrideByWeek.get(week)! : null;
    return {
      week,
      title: cw?.title ?? DEFAULT_WEEK_TITLE[week] ?? null,
      cohortOpen,
      override,
      open: resolveWeekOpen(cohortOpen, override),
      source: weekSource(cohortOpen, override),
    };
  });
}

/** override 가 null 이면 행을 지운다 — '기수 설정을 따른다' 로 되돌리는 것 */
export async function setActorWeekOverride(
  actorId: string,
  week: number,
  override: boolean | null
) {
  const supabase = db();

  if (override === null) {
    const { error } = await supabase
      .from('actor_week_overrides')
      .delete()
      .eq('actor_id', actorId)
      .eq('week', week);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from('actor_week_overrides')
    .upsert(
      { actor_id: actorId, week, is_open: override, updated_at: new Date().toISOString() },
      { onConflict: 'actor_id,week' }
    );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// 홈페이지 상담 문의
// ---------------------------------------------------------------------
export type InquiryStatus = 'new' | 'contacted' | 'done' | 'archived';

export type InquiryRow = {
  id: string;
  name: string;
  contact: string;
  message: string | null;
  source: string;
  /**
   * UTM 유입 정보. 홈페이지 쪽에서 준비 중인 컬럼이라 아직 DB 에 없을 수 있다.
   * 없으면 null 로 들어오고 화면에서 그냥 표시하지 않는다.
   */
  medium: string | null;
  campaign: string | null;
  content: string | null;
  status: InquiryStatus;
  adminMemo: string | null;
  createdAt: string;
  trackingRef: string;
  sessionId: string | null;
  clarityReady: boolean;
  landingPath: string | null;
  deviceType: string | null;
  browserContext: string | null;
  maxScroll: number;
  journeySeconds: number | null;
  ctaClicks: number;
  formStarted: boolean;
  smsNotificationStatus: string | null;
};

export async function listInquiries(): Promise<InquiryRow[]> {
  // 컬럼을 나열하지 않고 * 로 받는다 — medium/campaign/content 는 홈페이지 쪽
  // 마이그레이션이 적용된 뒤에야 생긴다. 나열하면 적용 전에 조회가 깨진다.
  const { data, error } = await db()
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const sessionIds = [...new Set((data ?? [])
    .map((row) => typeof row.session_id === 'string' ? row.session_id : null)
    .filter((id): id is string => Boolean(id)))];
  const [{ data: sessions }, { data: events }] = sessionIds.length
    ? await Promise.all([
      db()
        .from('analytics_sessions')
        .select('id, first_seen_at, landing_path, device_type, browser_context, clarity_ready, max_scroll')
        .in('id', sessionIds),
      db()
        .from('analytics_events')
        .select('session_id, event_name')
        .in('session_id', sessionIds),
    ])
    : [{ data: [] }, { data: [] }];

  const sessionById = new Map((sessions ?? []).map((session) => [session.id as string, session]));
  const eventsBySession = new Map<string, string[]>();
  for (const event of events ?? []) {
    const id = event.session_id as string;
    const names = eventsBySession.get(id) ?? [];
    names.push(event.event_name as string);
    eventsBySession.set(id, names);
  }

  // 값이 'unknown' 이면 유입을 모른다는 뜻이라 없는 것으로 친다.
  const meaningful = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s && s !== 'unknown' ? s : null;
  };

  return (data ?? []).map((r) => {
    const sessionId = typeof r.session_id === 'string' ? r.session_id : null;
    const session = sessionId ? sessionById.get(sessionId) : null;
    const eventNames = sessionId ? eventsBySession.get(sessionId) ?? [] : [];
    const firstSeenAt = typeof session?.first_seen_at === 'string' ? session.first_seen_at : null;
    const journeySeconds = firstSeenAt && eventNames.length > 0
      ? Math.max(0, Math.round((new Date(r.created_at).getTime() - new Date(firstSeenAt).getTime()) / 1000))
      : null;

    return {
      id: r.id,
      name: r.name,
      contact: r.contact,
      message: r.message,
      source: r.source,
      medium: meaningful(r.medium),
      campaign: meaningful(r.campaign),
      content: meaningful(r.content),
      status: r.status as InquiryStatus,
      adminMemo: r.admin_memo,
      createdAt: r.created_at,
      trackingRef: createLeadReference(r.id),
      sessionId,
      clarityReady: Boolean(r.clarity_ready || session?.clarity_ready),
      landingPath: meaningful(session?.landing_path),
      deviceType: meaningful(session?.device_type),
      browserContext: meaningful(session?.browser_context),
      maxScroll: Number(session?.max_scroll ?? 0),
      journeySeconds,
      ctaClicks: eventNames.filter((name) => name === 'click_consultation_cta').length,
      formStarted: eventNames.includes('form_start'),
      smsNotificationStatus: meaningful(r.sms_notification_status),
    };
  });
}

export async function getInquirySecuritySummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from('inquiry_security_events')
    .select('outcome, reason, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const byReason = new Map<string, number>();
  for (const row of rows) byReason.set(row.reason as string, (byReason.get(row.reason as string) ?? 0) + 1);
  return {
    blocked: rows.filter((row) => row.outcome === 'blocked').length,
    duplicates: rows.filter((row) => row.outcome === 'duplicate').length,
    warnings: rows.filter((row) => row.outcome === 'warning').length,
    byReason: [...byReason.entries()].sort((a, b) => b[1] - a[1]),
    latestAt: typeof rows[0]?.occurred_at === 'string' ? rows[0].occurred_at : null,
  };
}

export async function countNewInquiries(): Promise<number> {
  const { count } = await db()
    .from('inquiries')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');
  return count ?? 0;
}

export async function setInquiryStatus(id: string, status: InquiryStatus) {
  const { error } = await db().from('inquiries').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteInquiry(id: string) {
  const { error } = await db().from('inquiries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// 1:1 매체연기 코칭 — 퍼스널 리서치(actors)와 별개 트랙
// ---------------------------------------------------------------------
export type CoachingStudentRow = {
  id: string;
  name: string;
  birthYear: number | null;
  gender: Gender;
  contact: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  /** 퍼스널 브랜딩(actors)에서 넘어온 학생이면 그쪽 요약을 함께 담는다. */
  actor: {
    id: string;
    name: string;
    cohort: string | null;
    openWeeks: number[];
    surveys: { type: Category; n: number; minN: number; met: boolean }[];
  } | null;
};

export async function listCoachingStudents(): Promise<CoachingStudentRow[]> {
  const { data, error } = await db()
    .from('coaching_students')
    .select('id, name, birth_year, gender, contact, note, status, created_at, actor_id')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // 연동된 배우만 읽는다 — 예전에는 전체 배우 목록을 끌어왔다.
  const linkedIds = [
    ...new Set(
      (data ?? []).map((r) => r.actor_id as string | null).filter((v): v is string => Boolean(v))
    ),
  ];
  const actors = await listActorsByIds(linkedIds);
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return (data ?? []).map((r) => {
    const actor = r.actor_id ? actorById.get(r.actor_id as string) : undefined;
    return {
      id: r.id,
      name: r.name,
      birthYear: r.birth_year,
      gender: r.gender as Gender,
      contact: r.contact,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
      actor: actor
        ? {
            id: actor.id,
            name: actor.name,
            cohort: actor.cohort,
            openWeeks: actor.openWeeks,
            surveys: actor.surveys.map((s) => ({
              type: s.type,
              n: s.n,
              minN: s.minN,
              met: s.met,
            })),
          }
        : null,
    };
  });
}

/** 배우 상세에서 연동 버튼이 눌렸을 때 — 이미 연동돼 있으면 그 학생을 그대로 쓴다. */
export async function linkActorToCoaching(actorId: string): Promise<string> {
  const supabase = db();

  const { data: existing, error: findError } = await supabase
    .from('coaching_students')
    .select('id, status')
    .eq('actor_id', actorId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  // 보관 처리된 학생이 있으면 되살린다 — 같은 배우를 두 번 만들지 않는다.
  if (existing) {
    if (existing.status === 'archived') {
      const { error } = await supabase
        .from('coaching_students')
        .update({ status: 'active' })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    }
    return existing.id as string;
  }

  const actor = await getActor(actorId);
  if (!actor) throw new Error('배우를 찾을 수 없습니다.');

  const { data, error } = await supabase
    .from('coaching_students')
    .insert({
      name: actor.name,
      birth_year: actor.birthYear,
      gender: actor.gender,
      contact: actor.actorProfile?.phone || null,
      actor_id: actor.id,
      note: `퍼스널 브랜딩에서 연동됨${actor.cohort ? ` (${actor.cohort})` : ''}`,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/** 연동만 끊는다. 코칭 기록은 그대로 남는다. */
export async function unlinkCoachingStudent(id: string) {
  const { error } = await db().from('coaching_students').update({ actor_id: null }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** 이 배우가 이미 코칭으로 넘어갔는지 (배우 상세에서 버튼 상태를 정할 때 쓴다) */
export async function getCoachingLinkForActor(
  actorId: string
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await db()
    .from('coaching_students')
    .select('id, status')
    .eq('actor_id', actorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id as string, status: data.status as string } : null;
}

export async function createCoachingStudent(input: {
  name: string;
  birthYear: number | null;
  gender: Gender;
  contact: string | null;
}) {
  const { error } = await db().from('coaching_students').insert({
    name: input.name,
    birth_year: input.birthYear,
    gender: input.gender,
    contact: input.contact,
  });
  if (error) throw new Error(error.message);
}

export async function updateCoachingStudentNote(id: string, note: string) {
  const { error } = await db().from('coaching_students').update({ note }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archiveCoachingStudent(id: string) {
  const { error } = await db()
    .from('coaching_students')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function countOpenInquiries(): Promise<number> {
  const { count } = await db().from('inquiries').select('*', { count: 'exact', head: true }).not('status', 'in', '(done,archived)');
  return count ?? 0;
}

export async function countInquiriesWithMemo(): Promise<number> {
  const { count } = await db().from('inquiries').select('*', { count: 'exact', head: true }).not('admin_memo', 'is', null).neq('admin_memo', '');
  return count ?? 0;
}

export async function setInquiryMemo(id: string, memo: string) {
  const { error } = await db().from('inquiries').update({ admin_memo: memo.trim() || null }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// 상담 CRM
// ---------------------------------------------------------------------
export type ConsultationSessionRow = {
  id: string; actorId: string; consultedAt: string; consultationType: string;
  durationSeconds: number | null; counselorName: string | null; source: string;
  status: string; recordingPath: string | null; consentObtainedAt: string | null;
  createdAt: string; transcript: ConsultationTranscriptRow | null;
  analyses: ConsultationAnalysisRow[]; actionItemCount: number;
};
export type ConsultationTranscriptRow = { id: string; fullText: string; createdAt: string; updatedAt: string };
export type ConsultationAnalysisRow = {
  id: string; model: string; promptVersion: string; analysisVersion: number;
  summary: string | null; structuredResult: Record<string, unknown>; inputHash: string;
  status: string; reviewedAt: string | null; reviewedBy: string | null; createdAt: string;
};
export type ActionItemRow = {
  id: string; sessionId: string; actorId: string; title: string; description: string | null;
  assignee: string | null; dueAt: string | null; status: string; completedAt: string | null;
};

function mapSession(r: any, transcript: any, analyses: any[], actionItemCount: number): ConsultationSessionRow {
  return {
    id: r.id, actorId: r.actor_id, consultedAt: r.consulted_at, consultationType: r.consultation_type,
    durationSeconds: r.duration_seconds, counselorName: r.counselor_name, source: r.source,
    status: r.status, recordingPath: r.recording_path, consentObtainedAt: r.consent_obtained_at,
    createdAt: r.created_at,
    transcript: transcript ? { id: transcript.id, fullText: transcript.full_text, createdAt: transcript.created_at, updatedAt: transcript.updated_at } : null,
    analyses: analyses.map((a) => ({ id: a.id, model: a.model, promptVersion: a.prompt_version, analysisVersion: a.analysis_version, summary: a.summary, structuredResult: a.structured_result, inputHash: a.input_hash, status: a.status, reviewedAt: a.reviewed_at, reviewedBy: a.reviewed_by, createdAt: a.created_at })),
    actionItemCount,
  };
}

export async function listConsultationSessions(actorId: string): Promise<ConsultationSessionRow[]> {
  const supabase = db();
  const { data, error } = await supabase.from('consultation_sessions').select('*').eq('actor_id', actorId).neq('status', 'archived').order('consulted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(async (r: any) => {
    const [t, a, items] = await Promise.all([
      supabase.from('consultation_transcripts').select('id,full_text,created_at,updated_at').eq('session_id', r.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('consultation_analyses').select('*').eq('session_id', r.id).order('created_at', { ascending: false }),
      supabase.from('consultation_action_items').select('id', { count: 'exact', head: true }).eq('session_id', r.id).neq('status', 'done').neq('status', 'cancelled'),
    ]);
    if (t.error || a.error || items.error) throw new Error((t.error || a.error || items.error)!.message);
    return mapSession(r, t.data, a.data ?? [], items.count ?? 0);
  }));
}

export async function getConsultationSession(sessionId: string): Promise<ConsultationSessionRow | null> {
  const { data, error } = await db().from('consultation_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw new Error(error.message); if (!data) return null;
  const supabase = db();
  const [t, a, items] = await Promise.all([
    supabase.from('consultation_transcripts').select('id,full_text,created_at,updated_at').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consultation_analyses').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
    supabase.from('consultation_action_items').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).neq('status', 'done').neq('status', 'cancelled'),
  ]);
  if (t.error || a.error || items.error) throw new Error((t.error || a.error || items.error)!.message);
  return mapSession(data, t.data, a.data ?? [], items.count ?? 0);
}

export async function createConsultationSession(input: { actorId: string; consultedAt: string; consultationType: string; durationSeconds: number | null; counselorName: string | null; source: string; recordingPath: string | null; consentObtainedAt: string | null }) {
  const { data, error } = await db().from('consultation_sessions').insert({ actor_id: input.actorId, consulted_at: input.consultedAt, consultation_type: input.consultationType, duration_seconds: input.durationSeconds, counselor_name: input.counselorName, source: input.source, recording_path: input.recordingPath, consent_obtained_at: input.consentObtainedAt }).select('id').single();
  if (error) throw new Error(error.message); return data.id as string;
}
export async function updateConsultationSession(sessionId: string, input: Record<string, unknown>) { const { error } = await db().from('consultation_sessions').update(input).eq('id', sessionId); if (error) throw new Error(error.message); }
export async function archiveConsultationSession(sessionId: string) { await updateConsultationSession(sessionId, { status: 'archived', updated_at: new Date().toISOString() }); }
export async function getLatestTranscript(sessionId: string) { const { data, error } = await db().from('consultation_transcripts').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(1).maybeSingle(); if (error) throw new Error(error.message); return data; }
export async function saveConsultationTranscript(input: { sessionId: string; fullText: string }) {
  const text = input.fullText.trim();
  if (!text || text.length > 500_000) throw new Error('상담 원문 길이가 올바르지 않습니다.');
  const session = await getConsultationSession(input.sessionId);
  if (!session || session.status === 'archived') throw new Error('보관된 상담에는 원문을 추가할 수 없습니다.');
  const { error } = await db().from('consultation_transcripts').insert({ session_id: input.sessionId, full_text: text });
  if (error) throw new Error(error.message);
  await updateConsultationSession(input.sessionId, { status: 'reviewed', updated_at: new Date().toISOString() });
}
export async function listConsultationAnalyses(sessionId: string) { const { data, error } = await db().from('consultation_analyses').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }); if (error) throw new Error(error.message); return data ?? []; }
export async function getConsultationAnalysis(id: string) { const { data, error } = await db().from('consultation_analyses').select('id,session_id,status,structured_result').eq('id', id).maybeSingle(); if (error) throw new Error(error.message); return data; }
export async function saveConsultationAnalysis(input: { sessionId: string; model: string; promptVersion: string; analysisVersion: number; summary: string | null; structuredResult: unknown; inputHash: string; tokenUsage: unknown; status?: string }) { const { data, error } = await db().from('consultation_analyses').insert({ session_id: input.sessionId, model: input.model, prompt_version: input.promptVersion, analysis_version: input.analysisVersion, summary: input.summary, structured_result: input.structuredResult, input_hash: input.inputHash, token_usage: input.tokenUsage, status: input.status ?? 'pending' }).select('id').single(); if (error) throw new Error(error.message); return data.id as string; }
export async function approveConsultationAnalysis(id: string) { const { error } = await db().from('consultation_analyses').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: 'admin' }).eq('id', id); if (error) throw new Error(error.message); }
export async function rejectConsultationAnalysis(id: string) { const { error } = await db().from('consultation_analyses').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: 'admin' }).eq('id', id); if (error) throw new Error(error.message); }
export async function listActionItems(actorId: string): Promise<ActionItemRow[]> { const { data, error } = await db().from('consultation_action_items').select('*').eq('actor_id', actorId).neq('status', 'done').neq('status', 'cancelled').order('due_at', { ascending: true, nullsFirst: false }); if (error) throw new Error(error.message); return (data ?? []).map((r: any) => ({ id:r.id, sessionId:r.session_id, actorId:r.actor_id, title:r.title, description:r.description, assignee:r.assignee, dueAt:r.due_at, status:r.status, completedAt:r.completed_at })); }
export async function getActionItem(id: string) { const { data, error } = await db().from('consultation_action_items').select('id,session_id,actor_id,status').eq('id', id).maybeSingle(); if (error) throw new Error(error.message); return data; }
export async function createActionItem(input: { sessionId: string; actorId: string; title: string; description?: string | null; assignee?: string | null; dueAt?: string | null }) { const { error } = await db().from('consultation_action_items').insert({ session_id: input.sessionId, actor_id: input.actorId, title: input.title, description: input.description ?? null, assignee: input.assignee ?? null, due_at: input.dueAt ?? null }); if (error) throw new Error(error.message); }
export async function updateActionItem(id: string, input: { status?: string; title?: string; dueAt?: string | null }) {
  const allowedStatuses = ['todo', 'in_progress', 'done', 'cancelled'];
  if (input.status && !allowedStatuses.includes(input.status)) throw new Error('후속 조치 상태가 올바르지 않습니다.');
  if (input.title !== undefined && (!input.title.trim() || input.title.trim().length > 300)) throw new Error('후속 조치 제목이 올바르지 않습니다.');
  if (input.dueAt) {
    const due = new Date(input.dueAt);
    if (Number.isNaN(due.getTime())) throw new Error('후속 조치 기한이 올바르지 않습니다.');
  }
  const { error } = await db().from('consultation_action_items').update({ ...(input.status ? { status: input.status, completed_at: input.status === 'done' ? new Date().toISOString() : null } : {}), ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.dueAt !== undefined ? { due_at: input.dueAt } : {}), updated_at: new Date().toISOString() }).eq('id', id); if (error) throw new Error(error.message);
}
