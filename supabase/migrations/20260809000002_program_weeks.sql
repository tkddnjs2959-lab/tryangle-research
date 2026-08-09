-- =====================================================================
--  캐릭터 포지셔닝 클래스 — 기수별 1~12주차 공개 관리
--
--  대표가 주차를 하나씩 열어주는 구조다. 공개 판정은 두 단계로 나뉜다.
--
--    1) cohort_weeks         기수 단위 공개. '3기 4주차 공개' 하면 그 기수 전원
--    2) actor_week_overrides 배우별 예외. 특정 배우만 미리 열거나 막을 때
--
--  유효 공개 = override 가 있으면 그 값, 없으면 기수 값, 둘 다 없으면 비공개.
--  기수가 없는(cohort is null) 배우는 override 로만 열 수 있다.
--
--  주차 제목은 커리큘럼이 확정되지 않아 어드민에서 편집한다.
--  title 이 null 이면 화면에서 'N주차' 로 표시한다. 1주차만 기본값을 넣어둔다.
-- =====================================================================

create table cohort_weeks (
  id         uuid primary key default gen_random_uuid(),
  cohort     text not null,
  week       int  not null check (week between 1 and 12),
  title      text,                                    -- null 이면 'N주차'
  is_open    boolean not null default false,          -- 기수 전체 공개 여부
  opened_at  timestamptz,
  updated_at timestamptz not null default now(),
  unique (cohort, week)
);

create index cohort_weeks_cohort_idx on cohort_weeks (cohort);

-- 배우별 예외. is_open=true 는 강제 공개, false 는 강제 차단.
-- 행이 없으면 '기수 설정을 따른다' 는 뜻이다 — 그래서 3-state 를 행 유무로 표현한다.
create table actor_week_overrides (
  actor_id   uuid not null references actors (id) on delete cascade,
  week       int  not null check (week between 1 and 12),
  is_open    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (actor_id, week)
);

alter table cohort_weeks enable row level security;
alter table actor_week_overrides enable row level security;

-- 정책은 만들지 않는다. service_role 만 접근한다 (README 의 접근 원칙 참고).

-- ---------------------------------------------------------------------
-- 기존 [[week1_open]] 마커 이관
--
-- 1주차 공개 여부를 actors.note 안의 문자열로 들고 있던 임시 구현을
-- actor_week_overrides 로 옮기고 마커를 지운다.
-- 마커는 배우별로 켜던 것이므로 기수 공개가 아니라 override 로 옮긴다.
-- ---------------------------------------------------------------------
insert into actor_week_overrides (actor_id, week, is_open)
select id, 1, true
  from actors
 where note like '%[[week1_open]]%'
    on conflict (actor_id, week) do nothing;

update actors
   set note = nullif(
         btrim(
           regexp_replace(note, '^\s*\[\[week1_open\]\]\s*$', '', 'ng')
         ),
         ''
       )
 where note like '%[[week1_open]]%';

-- 기존 배우들의 기수에 1주차 행을 만들어 둔다 (제목 기본값만, 공개는 하지 않음).
insert into cohort_weeks (cohort, week, title)
select distinct cohort, 1, '퍼스널 리서치 툴'
  from actors
 where cohort is not null and btrim(cohort) <> ''
    on conflict (cohort, week) do nothing;
