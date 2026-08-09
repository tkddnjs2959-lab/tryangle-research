-- =====================================================================
--  TRY앵글 퍼스널 리서치 — 초기 스키마
--
--  접근 원칙: 브라우저는 DB에 직접 붙지 않는다.
--  Next.js 서버 라우트가 service key 로만 접근하고 토큰을 검증한다.
--  따라서 모든 테이블에 RLS 를 켜되 정책은 만들지 않는다.
--  (정책이 없으면 anon / authenticated 는 아무것도 못 읽는다.
--   service_role 은 RLS 를 우회하므로 서버 라우트만 동작한다.)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 공통 타입
-- ---------------------------------------------------------------------
do $$ begin
  create type research_category as enum ('self','image','personality');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_ver as enum ('female','male');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 링크 토큰 생성
--   혼동되는 글자(I, O, 0, 1)를 뺀 32자 알파벳.
--   카톡으로 주고받고 사람이 눈으로 옮겨 적을 수 있어야 한다.
--   8자 = 32^8 ≈ 1.1조 가지. 추측으로 남의 링크에 닿을 수 없다.
--   random() 이 아니라 gen_random_bytes() 를 쓴다 (예측 불가).
--   256 % 32 = 0 이므로 나머지 연산에 편향이 생기지 않는다.
-- ---------------------------------------------------------------------
create or replace function gen_token(len int default 8)
returns text
language plpgsql
volatile
-- Supabase 는 pgcrypto 를 extensions 스키마에 두는 경우가 많다.
-- 둘 중 어디에 설치돼 있든 gen_random_bytes 를 찾도록 명시한다.
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  res text := '';
  i int;
begin
  b := gen_random_bytes(len);
  for i in 1..len loop
    res := res || substr(alphabet, 1 + (get_byte(b, i-1) % 32), 1);
  end loop;
  return res;
end $$;

-- ---------------------------------------------------------------------
-- 배우
-- ---------------------------------------------------------------------
create table actors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  birth_year     int,
  gender         gender_ver not null default 'female',
  cohort         text,                                   -- 기수
  progress_token text not null unique default gen_token(8),  -- /s/토큰
  status         text not null default 'active'
                 check (status in ('active','done','archived')),
  note           text,                                   -- 어드민 메모
  created_at     timestamptz not null default now()
);

comment on column actors.progress_token is
  '배우가 진행 현황만 확인하는 /s/ 링크. 결과는 절대 노출하지 않는다.';

-- ---------------------------------------------------------------------
-- 키워드 사전
--   self 리서치는 image + personality 표를 모두 쓰므로
--   키워드 자체에는 self 가 없다.
-- ---------------------------------------------------------------------
create table keywords (
  id         serial primary key,
  category   research_category not null
             check (category in ('image','personality')),
  gender     gender_ver not null default 'female',
  label      text not null,
  sort_order int not null,                    -- 원본 PDF 표 순서
  active     boolean not null default true,
  unique (category, gender, label)
);

create index keywords_lookup_idx on keywords (gender, category, sort_order);

-- ---------------------------------------------------------------------
-- 리서치(설문)
--   배우 1명당 self / image / personality 3건이 자동 생성된다.
--
--   min_n : 가이드상 최소 참여 인원. 진행률 표시 기준.
--   cap_n : 자동 잠금 상한. 최소 인원을 넘겨 받는 건 환영이므로
--           min_n 이 아니라 넉넉한 상한에서 잠근다.
--           (셀프 체크만 1명이므로 1회 제출 후 바로 잠김)
-- ---------------------------------------------------------------------
create table surveys (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references actors(id) on delete cascade,
  type       research_category not null,
  token      text not null unique default gen_token(8),   -- /r/토큰
  min_n      int not null,
  cap_n      int,                                          -- null = 무제한
  closes_at  timestamptz,
  locked     boolean not null default false,               -- 수동 잠금
  created_at timestamptz not null default now(),
  unique (actor_id, type)
);

create index surveys_actor_idx on surveys (actor_id);

-- ---------------------------------------------------------------------
-- 응답
--   응답자의 이름·연락처는 받지 않는다. 익명이 전제다.
--   device_hash 는 중복 제출 탐지 용도로만 쓰는 단방향 해시.
-- ---------------------------------------------------------------------
create table responses (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references surveys(id) on delete cascade,
  device_hash  text,
  admin_memo   text,
  submitted_at timestamptz not null default now()
);

create index responses_survey_idx on responses (survey_id);
create index responses_device_idx on responses (survey_id, device_hash);

-- ---------------------------------------------------------------------
-- 응답 × 키워드
--   표에 있는 키워드는 keyword_id, 자유 입력은 custom_label.
-- ---------------------------------------------------------------------
create table response_keywords (
  id           bigserial primary key,
  response_id  uuid not null references responses(id) on delete cascade,
  keyword_id   int references keywords(id),
  custom_label text,
  check (keyword_id is not null or custom_label is not null)
);

create index response_keywords_response_idx on response_keywords (response_id);

-- 한 응답 안에서 같은 키워드를 두 번 세지 않는다
create unique index response_keywords_uniq_kw on response_keywords (response_id, keyword_id)
  where keyword_id is not null;
create unique index response_keywords_uniq_custom on response_keywords (response_id, custom_label)
  where custom_label is not null;

-- ---------------------------------------------------------------------
-- 확정 스냅샷
--   확정 시점의 렌더 설정을 통째로 남긴다.
--   (강조 곡선 / 끈 키워드 / 병합 / 배치 시드 / 글씨체 / 비율)
--   몇 달 뒤 재현 요청이 와도 같은 그림이 나온다.
-- ---------------------------------------------------------------------
create table snapshots (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references actors(id) on delete cascade,
  kind         text not null
               check (kind in ('bubble_image','bubble_personality','report')),
  config       jsonb not null,
  png_path     text,
  confirmed_at timestamptz not null default now(),
  delivered_at timestamptz                       -- 배우에게 전달한 시각
);

create index snapshots_actor_idx on snapshots (actor_id, kind, confirmed_at desc);

-- ---------------------------------------------------------------------
-- 배우 등록 시 리서치 3건 자동 생성
-- ---------------------------------------------------------------------
create or replace function create_surveys_for_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into surveys (actor_id, type, min_n, cap_n) values
    (new.id, 'self',        1, 1),
    (new.id, 'image',       8, 20),
    (new.id, 'personality', 5, 15);
  return new;
end $$;

create trigger trg_actor_create_surveys
after insert on actors
for each row execute function create_surveys_for_actor();

-- ---------------------------------------------------------------------
-- 진행 현황 뷰
--   /s/ 페이지와 어드민 목록이 함께 쓴다.
--   키워드는 일절 포함하지 않는다 — 숫자만.
-- ---------------------------------------------------------------------
create view survey_progress as
select
  s.id,
  s.actor_id,
  s.type,
  s.token,
  s.min_n,
  s.cap_n,
  s.locked,
  s.closes_at,
  count(r.id)::int as n,
  (count(r.id) >= s.min_n) as met,
  (
    not s.locked
    and (s.closes_at is null or s.closes_at > now())
    and (s.cap_n is null or count(r.id) < s.cap_n)
  ) as is_open
from surveys s
left join responses r on r.survey_id = s.id
group by s.id;

comment on view survey_progress is
  '진행 현황 전용. 응답 내용(키워드)은 이 뷰를 통해 새어나갈 수 없다.';

-- ---------------------------------------------------------------------
-- RLS — 정책 없이 켜기만 한다.
--   anon key 가 유출되어도 읽히는 것이 없다.
--   서버 라우트의 service_role 만 통과한다.
-- ---------------------------------------------------------------------
alter table actors            enable row level security;
alter table keywords          enable row level security;
alter table surveys           enable row level security;
alter table responses         enable row level security;
alter table response_keywords enable row level security;
alter table snapshots         enable row level security;

-- 뷰가 정의자 권한으로 RLS 를 우회하지 않도록 명시
alter view survey_progress set (security_invoker = on);
