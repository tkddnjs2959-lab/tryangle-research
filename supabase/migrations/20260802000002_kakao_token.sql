-- =====================================================================
--  카카오 '나에게 보내기' 토큰 저장소
--
--  홈페이지 문의 알림을 카카오톡으로 받기 위한 1회성 OAuth 연동.
--  refresh_token 은 ~60일마다 회전될 수 있어 정적 환경변수로는
--  부족하다 — 서버가 갱신 시 이 테이블에 다시 써야 한다.
--
--  단일 행만 존재한다 (관리자 본인 계정 하나).
--  다른 테이블과 동일한 원칙: RLS 켜고 정책 없음 (service_role 전용).
-- =====================================================================

create table kakao_token (
  id                     boolean primary key default true,
  refresh_token          text not null,
  refresh_token_expires_at timestamptz not null,
  updated_at             timestamptz not null default now(),
  constraint kakao_token_singleton check (id)
);

comment on table kakao_token is
  '카카오 나에게 보내기 API 용 refresh_token. 단일 행. service_role 전용 접근.';

alter table kakao_token enable row level security;
