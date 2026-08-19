/**
 * Microsoft Clarity 수동 스냅샷.
 *
 * Clarity API 연동 전에도 어드민에서 같은 기준으로 광고와 전체 유입을
 * 비교할 수 있도록 저장한다. 수치는 2026-08-18(어제) 데이터 기준이다.
 */
export const clarityReport = {
  capturedDate: '2026-08-18',
  periodLabel: '어제',
  overall: {
    sessions: 82,
    uniqueUsers: 78,
    newSessions: 78,
    returningSessions: 4,
    pagesPerSession: 1,
    scrollDepth: '21.44%',
    activeTime: '10초',
    totalTime: '39초',
    deadClickSessions: 4,
    deadClickRate: '4.88%',
  },
  paid: {
    label: 'Instagram paid_social / class_8',
    sessions: 74,
    uniqueUsers: 71,
    newSessions: 73,
    returningSessions: 1,
    pagesPerSession: 1,
    scrollDepth: '16.96%',
    activeTime: '10초',
    totalTime: '42초',
    deadClickSessions: 3,
    deadClickRate: '4.05%',
  },
  nonPaid: {
    sessions: 8,
    newSessions: 5,
    returningSessions: 3,
    estimatedScrollDepth: '약 63%',
    note: '전체와 광고 세션의 가중평균을 역산한 참고값이며 표본이 작다.',
  },
  sources: [
    { label: 'Instagram', sessions: 75 },
    { label: 'Naver', sessions: 2 },
    { label: '직접·미확인', sessions: 5 },
  ],
  campaigns: [
    { label: 'class_8', sessions: 74 },
    { label: 'profile_link', sessions: 1 },
    { label: '캠페인 태그 없음', sessions: 7 },
  ],
  findings: [
    '전체 유입의 90.2%가 class_8 광고에서 발생했다.',
    '광고 유입은 신규 비중이 높지만 평균 스크롤이 16.96%로 얕다.',
    '일반 유입은 8세션뿐이지만 광고보다 깊게 읽는 경향이 보인다.',
    '첫 화면 이후 신청 CTA와 전환 이벤트를 별도로 측정해야 한다.',
  ],
} as const;
