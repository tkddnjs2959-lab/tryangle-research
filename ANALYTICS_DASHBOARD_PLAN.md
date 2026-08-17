# 통합 분석 대시보드 운영 설계

## 현재 자동 계산되는 지표

- 문의 수, 신규 문의 수
- 상담 수, 문의 ID가 연결된 상담 수, 문의→상담 연결률
- AI 상담 분석 커버리지, 승인 대기 건수, 전환 가능성 신호
- 미완료 상담 후속 조치
- 마케팅 source / medium / campaign별 문의 및 상담 연결
- 상담에서 반복되는 니즈, 고민, 추천 프로그램, 위험 신호
- 과거 상담·수강생 목록의 기수별 참고 퍼널

광고비는 관리자 `광고비` 메뉴에서 행 단위로 수정하거나 CSV로 최대 1,000건까지 일괄 입력할 수 있다. CSV 필수 헤더는 `date, platform, spend`이며 캠페인·노출·클릭은 선택 항목이다.

모든 계산 로직은 `src/lib/admin-analytics.ts`에 모아 두고 화면은 결과만 표시한다. 지표 정의를 바꾸거나 새 지표를 추가할 때 한 파일을 중심으로 수정할 수 있다.

## 현재 연결된 데이터 모델

`enrollments`와 `payments` 테이블을 추가해 문의·상담 이후의 확정 등록과 결제를 관리자 화면에서 연결할 수 있다. 대시보드에는 확정 등록 수와 결제완료 금액(환불 차감)이 반영된다.

## 다음 데이터 모델

### marketing_spend_daily

- date
- platform: meta / google / kakao / naver 등
- account_id
- campaign_id / campaign_name
- adset_id / adset_name
- creative_id / creative_name
- spend
- impressions
- clicks

### enrollments

- inquiry_id
- actor_id
- cohort
- enrolled_at
- status
- attribution_source / medium / campaign / content

### payments

- enrollment_id
- paid_at
- amount
- status
- payment_type

## 연동 후 추가할 지표

- CPL = 광고비 / 문의 수
- 상담당 비용 = 광고비 / 상담 연결 문의 수
- 등록 CPA = 광고비 / 확정 등록 수
- 문의→상담→등록 단계별 전환율
- ROAS = 귀속 매출 / 광고비
- 캠페인·소재·기수별 매출과 수익성
- 최초 유입과 최종 유입을 함께 보는 멀티터치 비교

## 저장 원칙

- Supabase: 검색·집계·권한 관리가 필요한 기준 데이터
- Google Drive: Clova Note 원본, 동의서, 내보낸 보고서와 백업
- 대시보드: 원본 파일이 아니라 Supabase의 정규화된 데이터만 조회
- 개인정보가 포함된 원문은 공개 클라이언트에서 직접 조회하지 않고 서버 전용 경로로만 처리
