-- =====================================================================
--  배우 카카오 알림 — 토큰 저장
--
--  주차를 열어도 배우가 우연히 링크를 들어와야 알 수 있었다.
--  배우 본인의 카카오 토큰으로 '나에게 보내기'(talk/memo/default/send)를
--  호출하면 배우의 '나와의 채팅' 으로 알림이 간다. 건당 비용이 없다.
--
--  access_token 은 ~12시간이라 저장해봐야 소용없고, refresh_token(~60일)을
--  저장해뒀다가 보낼 때마다 access_token 을 새로 받는다.
--  홈페이지의 kakao_token 테이블과 같은 방식이되, 그쪽은 관리자 한 명이라
--  단일 행이고 이쪽은 배우마다 다르므로 actor_accounts 에 붙인다.
--
--  주의: 이 토큰은 배우 계정으로 메시지를 보낼 수 있는 값이다.
--  service_role 로만 접근한다 (actor_accounts 는 RLS 켜짐 · 정책 없음).
-- =====================================================================

alter table actor_accounts
  add column kakao_refresh_token      text,
  add column kakao_refresh_expires_at timestamptz,
  -- 배우가 알림을 원치 않을 때 끄는 스위치. 기본은 켬.
  add column notify_enabled           boolean not null default true,
  -- 같은 주차를 두 번 알리지 않기 위한 기록 (주차 번호 배열)
  add column notified_weeks           int[] not null default '{}';
