-- =====================================================================
--  배우 계정·프로필을 actors.note 에서 분리
--
--  그동안 카카오 ID와 배우가 등록한 프로필을 actors.note 안에
--  [[kakao_user_id:...]] / [[actor_profile:{JSON}]] 문자열로 넣어두고 있었다.
--  두 가지가 실제로 문제였다.
--
--    1) 카카오 로그인 조회가 note LIKE '%...%' 라 인덱스를 못 탄다.
--    2) note 는 대표가 쓰는 메모 칸이기도 하다. 메모를 편집하다 마커가
--       지워지면 그 배우의 카카오 로그인이 조용히 끊긴다.
--
--  note 는 사람이 쓰는 메모로 되돌리고, 기계가 읽는 값은 이 테이블에 둔다.
--
--  kakao_user_id 는 unique — 카카오 계정 하나가 배우 두 명에 붙지 않는다.
--  지금까지는 앱 코드에서만 막고 있었다 (kakao_already_linked).
-- =====================================================================

create table actor_accounts (
  actor_id       uuid primary key references actors (id) on delete cascade,
  kakao_user_id  text unique,
  kakao_nickname text,
  name           text,           -- 배우가 직접 등록한 이름 (actors.name 은 대표가 쓰는 값)
  phone          text,
  memo           text,           -- 배우가 남긴 메모. 대표 메모(actors.note)와 다르다
  updated_at     timestamptz not null default now()
);

alter table actor_accounts enable row level security;
-- 정책 없음 — service_role 만 접근한다 (README 의 접근 원칙 참고).

-- ---------------------------------------------------------------------
-- 기존 마커 이관
--
-- 적용 시점 기준으로 마커가 달린 배우는 0명이라 실제로 옮겨지는 행은 없다.
-- 다른 환경(로컬 복제본 등)에서 늦게 적용될 때를 위해 남겨둔다.
-- ---------------------------------------------------------------------
insert into actor_accounts (actor_id, kakao_user_id, kakao_nickname, name, phone, memo)
select a.id,
       substring(a.note from '\[\[kakao_user_id:([^\]]+)\]\]'),
       nullif(btrim(coalesce(p.json_text::jsonb ->> 'kakaoNickname', '')), ''),
       nullif(btrim(coalesce(p.json_text::jsonb ->> 'name', '')), ''),
       nullif(btrim(coalesce(p.json_text::jsonb ->> 'phone', '')), ''),
       nullif(btrim(coalesce(p.json_text::jsonb ->> 'memo', '')), '')
  from actors a
  left join lateral (
         select substring(a.note from '\[\[actor_profile:(.+)\]\]') as json_text
       ) p on true
 where a.note like '%[[kakao_user_id:%'
    or a.note like '%[[actor_profile:%'
    on conflict (actor_id) do nothing;

-- 마커 줄만 걷어내고 사람이 쓴 메모는 남긴다.
update actors
   set note = nullif(
         btrim(
           regexp_replace(
             regexp_replace(note, '^\s*\[\[kakao_user_id:[^\]]*\]\]\s*$', '', 'ng'),
             '^\s*\[\[actor_profile:.*\]\]\s*$', '', 'ng'
           )
         ),
         ''
       )
 where note like '%[[kakao_user_id:%'
    or note like '%[[actor_profile:%';
