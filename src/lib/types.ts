/**
 * 서버·클라이언트가 함께 쓰는 타입과 문구.
 *
 * 이 파일에는 'server-only' 를 붙이지 않는다.
 * 클라이언트 컴포넌트가 import 하므로 서버 전용 코드가 섞이면 안 된다.
 * DB 접근은 research.ts 에만 둔다.
 */

export type Category = 'self' | 'image' | 'personality';
export type Gender = 'female' | 'male';

export type Keyword = { id: number; category: 'image' | 'personality'; label: string };

export type SurveyView = {
  token: string;
  type: Category;
  actorName: string;
  gender: Gender;
  isOpen: boolean;
  closedReason: 'locked' | 'expired' | 'full' | null;
  keywords: Keyword[];
};

export const CATEGORY_LABEL: Record<Category, string> = {
  self: '셀프 체크',
  image: '이미지 리서치',
  personality: '퍼스널리티 리서치',
};

/** 리서치별 대상 안내 — 퍼스널 리서치 가이드 원문 기준 */
export const AUDIENCE: Record<Category, string> = {
  self: '배우 본인',
  image: '적당한 거리를 지키는 지인 (가족·연인·친한 지인 제외)',
  personality: '가족, 연인, 친한 지인 등 나를 잘 아는 사람',
};

/** 링크 종류별 첫 화면 문구 */
export const GUIDE: Record<Category, { title: string; lead: string; points: string[] }> = {
  self: {
    title: '셀프 체크',
    lead: '내가 생각하는 ‘나’의 이미지와 퍼스널리티를 체크해주세요.',
    points: [
      '이미지와 퍼스널리티 두 가지를 모두 체크합니다.',
      '정답은 없습니다. 스스로 그렇다고 느끼는 쪽으로 골라주세요.',
    ],
  },
  image: {
    title: '이미지 리서치',
    lead: '{name} 님의 이미지에 해당하는 키워드를 체크해주세요.',
    points: [
      '고민하거나 깊이 생각하지 마시고, 직관적으로 빠르게 체크해주세요.',
      '보여지는 이미지와 부합하는 키워드를 고르시면 됩니다.',
    ],
  },
  personality: {
    title: '퍼스널리티 리서치',
    lead: '내가 아는 {name} 님에 해당하는 키워드를 체크해주세요.',
    points: [
      '평소 알고 계신 {name} 님의 성격과 성향을 떠올려주세요.',
      '가까이서 지켜본 모습을 기준으로 골라주시면 됩니다.',
    ],
  },
};

export const SECTION_LABEL = { image: '이미지', personality: '퍼스널리티' } as const;

export const RECOMMEND_MIN = 8;
export const RECOMMEND_MAX = 12;

/** 토큰은 gen_token(8) 이 만드는 형식만 허용한다 (I·O·0·1 제외 32자 알파벳) */
export const TOKEN_RE = /^[A-HJ-NP-Z2-9]{8}$/;
