create table if not exists public.schedule_period_closures (
  period_type text not null check (period_type in ('week', 'month')),
  period_key text not null,
  closed_at timestamptz not null default now(),
  primary key (period_type, period_key)
);
alter table public.schedule_period_closures enable row level security;

create or replace function public.schedule_session_lock_guard()
returns trigger language plpgsql as $$
declare
  lesson_day date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    lesson_day := old.lesson_date;
    if exists (
      select 1 from public.schedule_period_closures
      where (period_type = 'month' and period_key = to_char(lesson_day, 'YYYY-MM'))
         or (period_type = 'week' and period_key = to_char(lesson_day - (extract(isodow from lesson_day)::integer - 1), 'YYYY-MM-DD'))
    ) then
      raise exception '마감된 시간표는 수정할 수 없습니다.';
    end if;
  end if;
  if tg_op in ('UPDATE', 'INSERT') then
    lesson_day := new.lesson_date;
    if exists (
      select 1 from public.schedule_period_closures
      where (period_type = 'month' and period_key = to_char(lesson_day, 'YYYY-MM'))
         or (period_type = 'week' and period_key = to_char(lesson_day - (extract(isodow from lesson_day)::integer - 1), 'YYYY-MM-DD'))
    ) then
      raise exception '마감된 시간표는 수정할 수 없습니다.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists schedule_session_lock_guard on public.lesson_sessions;
create trigger schedule_session_lock_guard
before insert or update or delete on public.lesson_sessions
for each row execute function public.schedule_session_lock_guard();
