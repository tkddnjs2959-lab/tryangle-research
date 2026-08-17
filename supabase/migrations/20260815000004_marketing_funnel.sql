-- 문의 → 상담 → 수강등록 → 결제 퍼널을 연결하는 운영 테이블
-- 관리자 서버(service_role)에서만 조회·수정하며 공개 API에는 노출하지 않는다.

create table if not exists enrollments (
  id                 uuid primary key default gen_random_uuid(),
  inquiry_id         uuid references inquiries(id) on delete set null,
  actor_id           uuid references actors(id) on delete set null,
  cohort             text,
  status             text not null default 'applied'
                     check (status in ('applied', 'enrolled', 'paused', 'completed', 'cancelled')),
  enrolled_at        timestamptz,
  source             text,
  medium             text,
  campaign           text,
  content            text,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  enrollment_id      uuid not null references enrollments(id) on delete cascade,
  paid_at            timestamptz,
  amount             numeric(12, 2) not null check (amount >= 0),
  currency           text not null default 'KRW',
  status             text not null default 'pending'
                     check (status in ('pending', 'paid', 'refunded', 'void')),
  payment_type       text,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists enrollments_inquiry_idx on enrollments (inquiry_id);
create index if not exists enrollments_actor_status_idx on enrollments (actor_id, status);
create index if not exists enrollments_campaign_idx on enrollments (campaign);
create index if not exists payments_enrollment_idx on payments (enrollment_id);
create index if not exists payments_paid_status_idx on payments (paid_at, status);

alter table enrollments enable row level security;
alter table payments enable row level security;
revoke all on table enrollments, payments from anon, authenticated;
grant all on table enrollments, payments to service_role;
