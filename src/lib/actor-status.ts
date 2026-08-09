/**
 * 배우가 지금 어느 단계에 있고, 대표가 무엇을 해야 하는지.
 *
 * 어드민 목록에서 배우가 늘어나면 "응답 3/8" 같은 숫자만으로는
 * 지금 손댈 배우를 골라내기 어렵다. 숫자를 한 문장으로 바꿔준다.
 *
 * 순수 함수라 'server-only' 를 붙이지 않는다 — DB 접근은 admin-data.ts 에만 둔다.
 */

import { WEEK_COUNT } from './weeks';
import type { Category } from './types';

export type ActorStatusKey = 'collecting' | 'ready' | 'running' | 'done';

export type ActorStatus = {
  key: ActorStatusKey;
  /** 상태 뱃지에 쓰는 짧은 말 */
  label: string;
  /** 대표가 지금 할 일 한 줄 */
  action: string;
  /** 목록에서 위로 끌어올릴지 — 대표가 바로 손댈 수 있는 배우 */
  urgent: boolean;
};

type StatusInput = {
  surveys: { type: Category; n: number; minN: number; met: boolean }[];
  openWeeks: number[];
};

/** 정렬 순서 — 조치가 필요한 것부터 */
const ORDER: Record<ActorStatusKey, number> = {
  ready: 0,
  collecting: 1,
  running: 2,
  done: 3,
};

export function actorStatus({ surveys, openWeeks }: StatusInput): ActorStatus {
  const self = surveys.find((s) => s.type === 'self');
  const selfDone = (self?.n ?? 0) > 0;
  const outgoing = surveys.filter((s) => s.type !== 'self');
  const pending = outgoing.filter((s) => !s.met);

  const opened = openWeeks.length;

  // 12주차까지 다 열었으면 끝난 배우다.
  if (opened >= WEEK_COUNT) {
    return {
      key: 'done',
      label: '과정 완료',
      action: `${WEEK_COUNT}주차까지 모두 공개했습니다.`,
      urgent: false,
    };
  }

  // 이미 진행 중이면 다음 주차를 여는 게 할 일이다.
  if (opened > 0) {
    const next = Math.max(...openWeeks) + 1;
    return {
      key: 'running',
      label: `${opened}/${WEEK_COUNT}주차`,
      action: `다음은 ${Math.min(next, WEEK_COUNT)}주차 공개입니다.`,
      urgent: false,
    };
  }

  // 아직 아무 주차도 안 열렸다 — 리서치가 다 모였는지로 갈린다.
  if (pending.length > 0 || !selfDone) {
    const parts = pending.map((s) => `${LABEL[s.type]} ${s.n}/${s.minN}`);
    if (!selfDone) parts.push('셀프 체크 미완료');
    return {
      key: 'collecting',
      label: '응답 수집 중',
      action: `${parts.join(' · ')} — 링크를 더 돌려야 합니다.`,
      urgent: false,
    };
  }

  return {
    key: 'ready',
    label: '검수 대기',
    action: '최소 인원이 모였습니다. 검수 후 1주차를 공개하세요.',
    urgent: true,
  };
}

const LABEL: Record<Category, string> = {
  self: '셀프 체크',
  image: '이미지',
  personality: '퍼스널리티',
};

export function compareByStatus(a: ActorStatus, b: ActorStatus): number {
  return ORDER[a.key] - ORDER[b.key];
}

export const STATUS_SUMMARY_LABEL: Record<ActorStatusKey, string> = {
  ready: '검수 대기',
  collecting: '응답 수집 중',
  running: '주차 진행 중',
  done: '과정 완료',
};
