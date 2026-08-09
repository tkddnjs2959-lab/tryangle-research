-- =====================================================================
--  1:1 매체연기 코칭 — 학생 관리
--
--  퍼스널 리서치(actors)와는 완전히 별개 트랙이다.
--  키워드 리서치 없이 배우 정보 + 메모만 관리한다.
--  나중에 회차/일정/결제 같은 필드가 필요해지면 이 테이블에 추가한다.
-- =====================================================================

create table coaching_students (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  birth_year int,
  gender     gender_ver not null default 'female',
  contact    text,                                   -- 연락처 (선택)
  note       text,                                    -- 어드민 메모 · 코칭 기록
  status     text not null default 'active'
             check (status in ('active','done','archived')),
  created_at timestamptz not null default now()
);

alter table coaching_students enable row level security;
