import 'server-only';
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
  actorProfile: { name: string; phone: string; updatedAt: string } | null;
  createdAt: string;
  surveys: { type: Category; token: string; n: number; minN: number; met: boolean; isOpen: boolean }[];
};

const ORDER: Category[] = ['image', 'personality', 'self'];
const KAKAO_ID_RE = /^\[\[kakao_user_id:([^\]]+)\]\]$/m;
const PROFILE_RE = /^\[\[actor_profile:(.+)\]\]$/m;

function parseActorProfile(note: string | null): ActorRow['actorProfile'] {
  const raw = note?.match(PROFILE_RE)?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: string; phone?: string; updatedAt?: string };
    return {
      name: String(parsed.name ?? ''),
      phone: String(parsed.phone ?? ''),
      updatedAt: String(parsed.updatedAt ?? ''),
    };
  } catch {
    return null;
  }
}

export async function listActors(): Promise<ActorRow[]> {
  const supabase = db();

  const { data: actors } = await supabase
    .from('actors')
    .select('id, name, birth_year, gender, cohort, status, progress_token, note, created_at')
    .order('created_at', { ascending: false });

  if (!actors?.length) return [];

  const [{ data: progress }, { data: cohortWeeks }, { data: overrides }] = await Promise.all([
    supabase.from('survey_progress').select('actor_id, type, token, n, min_n, met, is_open'),
    supabase.from('cohort_weeks').select('cohort, week').eq('is_open', true),
    supabase.from('actor_week_overrides').select('actor_id, week, is_open'),
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
    kakaoLinked: KAKAO_ID_RE.test(String(a.note ?? '')),
    actorProfile: parseActorProfile(a.note),
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

export async function getActor(id: string): Promise<ActorRow | null> {
  const all = await listActors();
  return all.find((a) => a.id === id) ?? null;
}

export type ResponseRow = {
  id: string;
  submittedAt: string;
  deviceHash: string | null;
  labels: string[];
};

/** 어드민만 볼 수 있는 개별 응답. 배우에게는 절대 노출하지 않는다. */
export async function listResponses(
  actorId: string,
  type: Category
): Promise<ResponseRow[]> {
  const supabase = db();

  const { data: survey } = await supabase
    .from('surveys')
    .select('id')
    .eq('actor_id', actorId)
    .eq('type', type)
    .maybeSingle();

  if (!survey) return [];

  const { data } = await supabase
    .from('responses')
    .select('id, submitted_at, device_hash, response_keywords(custom_label, keywords(label))')
    .eq('survey_id', survey.id)
    .order('submitted_at', { ascending: true });

  return (data ?? []).map((r) => {
    const rks = (r.response_keywords ?? []) as {
      custom_label: string | null;
      keywords: { label: string } | { label: string }[] | null;
    }[];
    return {
      id: r.id,
      submittedAt: r.submitted_at,
      deviceHash: r.device_hash,
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

export async function deleteResponse(id: string) {
  const { error } = await db().from('responses').delete().eq('id', id);
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
  status: InquiryStatus;
  adminMemo: string | null;
  createdAt: string;
};

export async function listInquiries(): Promise<InquiryRow[]> {
  const { data, error } = await db()
    .from('inquiries')
    .select('id, name, contact, message, source, status, admin_memo, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    message: r.message,
    source: r.source,
    status: r.status as InquiryStatus,
    adminMemo: r.admin_memo,
    createdAt: r.created_at,
  }));
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
};

export async function listCoachingStudents(): Promise<CoachingStudentRow[]> {
  const { data, error } = await db()
    .from('coaching_students')
    .select('id, name, birth_year, gender, contact, note, status, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    birthYear: r.birth_year,
    gender: r.gender as Gender,
    contact: r.contact,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  }));
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
