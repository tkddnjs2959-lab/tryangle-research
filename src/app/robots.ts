import type { MetadataRoute } from 'next';

/**
 * 이 앱 전체를 검색엔진에서 막는다.
 *
 * 어드민·배우 진행 현황·응답 페이지 어느 것도 공개 대상이 아니다.
 * 경로를 나열하지 않고 통째로 막는 이유 — robots.txt 는 공개 파일이라
 * 경로를 적으면 "여기 숨은 주소가 있다"고 알려주는 꼴이 된다.
 * 이 앱은 전부 비공개라 전체 차단으로 끝난다.
 *
 * 물론 robots.txt 는 예의 바른 크롤러에게만 통한다. 실제 접근 통제는
 * 토큰(추측 불가한 8자리)과 어드민 로그인이 담당한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
