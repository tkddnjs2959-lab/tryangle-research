-- 메인 홈페이지 방문을 날짜별 익명 합계로만 보관한다.
create table if not exists public.homepage_daily_visits (
  visit_date date primary key,
  visitor_count bigint not null default 0 check (visitor_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.homepage_daily_visits is
  '메인 홈페이지의 KST 날짜별 익명 브라우저 방문 수. 개인 식별 정보는 저장하지 않는다.';

alter table public.homepage_daily_visits enable row level security;
revoke all on table public.homepage_daily_visits from anon, authenticated;
grant select, insert, update on table public.homepage_daily_visits to service_role;

create or replace function public.increment_homepage_daily_visit(p_visit_date date)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.homepage_daily_visits (visit_date, visitor_count, updated_at)
  values (p_visit_date, 1, now())
  on conflict (visit_date)
  do update set
    visitor_count = public.homepage_daily_visits.visitor_count + 1,
    updated_at = now();
$$;

revoke all on function public.increment_homepage_daily_visit(date) from public, anon, authenticated;
grant execute on function public.increment_homepage_daily_visit(date) to service_role;
