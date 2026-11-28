create table public.coaching_monthly_registrations (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.coaching_students(id), service_month date not null check (extract(day from service_month)=1),
 lesson_plan text, teacher text, tuition integer check (tuition >= 0), paid_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(student_id,service_month)
);
alter table public.coaching_monthly_registrations enable row level security;
revoke all on public.coaching_monthly_registrations from anon, authenticated;
grant all on public.coaching_monthly_registrations to service_role;
create index coaching_monthly_registrations_month on public.coaching_monthly_registrations(service_month);