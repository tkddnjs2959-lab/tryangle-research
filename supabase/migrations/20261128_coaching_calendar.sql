-- 상담 일정은 학생에 연결하고 수강 시작일은 수동 지정이 없으면 첫 수업 배정일로 계산한다.
alter table public.coaching_students add column if not exists first_start_date date;
create table if not exists public.coaching_consultations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.coaching_students(id) on delete cascade,
  consultation_date date not null,
  consultation_time time,
  status text not null default 'planned' check (status in ('planned','done','canceled')),
  teacher text,
  note text,
  follow_up_date date,
  next_action text,
  created_at timestamptz not null default now()
);
create index if not exists coaching_consultations_student_date_idx on public.coaching_consultations(student_id, consultation_date desc);
create index if not exists coaching_consultations_date_idx on public.coaching_consultations(consultation_date);
alter table public.coaching_consultations enable row level security;
revoke all on public.coaching_consultations from anon, authenticated;
