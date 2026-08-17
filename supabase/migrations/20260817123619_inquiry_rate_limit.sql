create table if not exists public.inquiry_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists inquiry_rate_limits_updated_idx
  on public.inquiry_rate_limits (updated_at desc);

alter table public.inquiry_rate_limits enable row level security;
revoke all on table public.inquiry_rate_limits from anon, authenticated;
grant all on table public.inquiry_rate_limits to service_role;

create or replace function public.consume_inquiry_rate_limit(
  p_key text,
  p_limit integer default 5,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed boolean;
begin
  if p_key is null or length(trim(p_key)) = 0
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.inquiry_rate_limits (key, window_started_at, request_count, updated_at)
  values (trim(p_key), now(), 1, now())
  on conflict (key) do update
  set
    request_count = case
      when public.inquiry_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else public.inquiry_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.inquiry_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else public.inquiry_rate_limits.window_started_at
    end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.consume_inquiry_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_inquiry_rate_limit(text, integer, integer) to service_role;
