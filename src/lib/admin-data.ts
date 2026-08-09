import 'server-only';
import { db } from './supabase';
import type { Category, Gender } from './types';

export type ActorRow = {
  id: string;
  name: string;
  birthYear: number | null;
  gender: Gender;
  cohort: string | null;
  status: string;
  progressToken: string;
  createdAt: string;
  surveys: { type: Category; token: string; n: number; minN: number; met: boolean; isOpen: boolean }[];
};

const ORDER: Category[] = ['image', 'personality', 'self'];

export async function listActors(): Promise<ActorRow[]> {
  const supabase = db();

  const { data: actors } = await supabase
    .from('actors')
    .select('id, name, birth_year, gender, cohort, status, progress_token, created_at')
    .order('created_at', { ascending: false });

  if (!actors?.length) return [];

  const { data: progress } = await supabase
    .from('survey_progress')
    .select('actor_id, type, token, n, min_n, met, is_open');

  return actors.map((a) => ({
    id: a.id,
    name: a.name,
    birthYear: a.birth_year,
    gender: a.gender,
    cohort: a.cohort,
    status: a.status,
    progressToken: a.progress_token,
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
