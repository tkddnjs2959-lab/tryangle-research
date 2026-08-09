import 'server-only';
import { db } from './supabase';
import { TOKEN_RE, type Category, type Gender, type Keyword, type SurveyView } from './types';

const WEEK1_OPEN_MARK = '[[week1_open]]';

/**
 * 토큰으로 리서치를 조회한다.
 * 응답 페이지가 쓰는 유일한 진입점 — 다른 배우의 정보는 나올 수 없다.
 */
export async function getSurveyByToken(token: string): Promise<SurveyView | null> {
  if (!TOKEN_RE.test(token)) return null;

  const supabase = db();

  const { data: survey, error } = await supabase
    .from('surveys')
    .select('id, type, cap_n, locked, closes_at, actors!inner(name, gender)')
    .eq('token', token)
    .maybeSingle();

  if (error || !survey) return null;

  // supabase-js 는 조인 결과를 객체 또는 배열로 돌려준다. 둘 다 받아준다.
  const actorRaw = (survey as Record<string, unknown>).actors;
  const actor = (Array.isArray(actorRaw) ? actorRaw[0] : actorRaw) as {
    name: string;
    gender: Gender;
  };
  if (!actor) return null;

  const { count } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', survey.id);

  const n = count ?? 0;

  let closedReason: SurveyView['closedReason'] = null;
  if (survey.locked) closedReason = 'locked';
  else if (survey.closes_at && new Date(survey.closes_at) <= new Date()) closedReason = 'expired';
  else if (survey.cap_n !== null && n >= survey.cap_n) closedReason = 'full';

  // 셀프 체크는 이미지·퍼스널리티 두 표를 모두 쓴다
  const categories: ('image' | 'personality')[] =
    survey.type === 'self' ? ['image', 'personality'] : [survey.type];

  const { data: keywords } = await supabase
    .from('keywords')
    .select('id, category, label')
    .eq('gender', actor.gender)
    .eq('active', true)
    .in('category', categories)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  return {
    token,
    type: survey.type,
    actorName: actor.name,
    gender: actor.gender,
    isOpen: closedReason === null,
    closedReason,
    keywords: (keywords ?? []) as Keyword[],
  };
}

export type SurveyProgress = {
  type: Category;
  token: string;
  n: number;
  minN: number;
  met: boolean;
  isOpen: boolean;
};

export type ProgressView = {
  actorName: string;
  week1Open: boolean;
  surveys: SurveyProgress[];
};

/**
 * 배우가 보는 진행 현황.
 *
 * survey_progress 뷰에는 키워드 컬럼이 아예 없다.
 * 이 함수가 응답 내용을 실수로 흘릴 경로는 구조적으로 없다.
 */
export async function getProgressByToken(token: string): Promise<ProgressView | null> {
  if (!TOKEN_RE.test(token)) return null;

  const supabase = db();

  const { data: actor } = await supabase
    .from('actors')
    .select('id, name, note')
    .eq('progress_token', token)
    .maybeSingle();

  if (!actor) return null;

  const { data: rows } = await supabase
    .from('survey_progress')
    .select('type, token, n, min_n, met, is_open')
    .eq('actor_id', actor.id);

  const order: Category[] = ['image', 'personality', 'self'];
  const surveys = (rows ?? [])
    .map((r) => ({
      type: r.type as Category,
      token: r.token as string,
      n: r.n as number,
      minN: r.min_n as number,
      met: r.met as boolean,
      isOpen: r.is_open as boolean,
    }))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  return {
    actorName: actor.name,
    week1Open: String(actor.note ?? '').includes(WEEK1_OPEN_MARK),
    surveys,
  };
}

/** DB 함수(submit_response)가 올리는 코드 → 사람이 읽는 문구 */
export const SUBMIT_ERRORS: Record<string, { status: number; message: string }> = {
  SURVEY_NOT_FOUND: { status: 404, message: '존재하지 않는 링크입니다.' },
  SURVEY_CLOSED: { status: 409, message: '이미 마감된 리서치입니다.' },
  EMPTY_SUBMISSION: { status: 400, message: '키워드를 하나 이상 선택해주세요.' },
  INVALID_KEYWORD: { status: 400, message: '이 리서치에 없는 키워드가 포함되어 있습니다.' },
};
