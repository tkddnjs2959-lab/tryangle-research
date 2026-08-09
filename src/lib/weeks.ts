/**
 * 기수별 1~12주차 공개 관리에서 서버·클라이언트가 함께 쓰는 타입과 문구.
 *
 * types.ts 와 같은 이유로 'server-only' 를 붙이지 않는다.
 * DB 접근은 admin-data.ts 에만 둔다.
 */

export const WEEK_COUNT = 12;
export const WEEKS = Array.from({ length: WEEK_COUNT }, (_, i) => i + 1);

/**
 * 커리큘럼이 확정되지 않아 제목은 어드민에서 편집한다.
 * 여기 있는 것만 기본값으로 깔리고, 나머지는 'N주차' 로 표시된다.
 */
export const DEFAULT_WEEK_TITLE: Record<number, string> = {
  1: '퍼스널 리서치 툴',
};

export function weekLabel(week: number, title?: string | null): string {
  const name = title?.trim() || DEFAULT_WEEK_TITLE[week] || '';
  return name ? `${week}주차 · ${name}` : `${week}주차`;
}

/** 배우별 예외. 행이 없으면(null) 기수 설정을 따른다. */
export type WeekOverride = boolean | null;

export type CohortWeek = {
  week: number;
  title: string | null;
  isOpen: boolean;
  openedAt: string | null;
};

/** 한 배우의 한 주차 상태 — 유효 공개 여부와 그 근거를 함께 넘긴다. */
export type ActorWeek = {
  week: number;
  title: string | null;
  cohortOpen: boolean;
  override: WeekOverride;
  open: boolean;
  source: 'cohort' | 'override' | 'closed';
};

/**
 * 유효 공개 판정.
 * 배우 예외가 있으면 그 값이 이기고, 없으면 기수 값을 따른다.
 */
export function resolveWeekOpen(cohortOpen: boolean, override: WeekOverride): boolean {
  return override ?? cohortOpen;
}

export function weekSource(cohortOpen: boolean, override: WeekOverride): ActorWeek['source'] {
  if (override !== null) return override ? 'override' : 'closed';
  return cohortOpen ? 'cohort' : 'closed';
}

export const SOURCE_LABEL: Record<ActorWeek['source'], string> = {
  cohort: '기수 공개',
  override: '이 배우만 공개',
  closed: '비공개',
};
