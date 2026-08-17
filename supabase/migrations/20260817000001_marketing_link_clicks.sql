-- 외부 채널(카카오톡 등)로 이동하기 전의 익명 클릭 집계.
-- service_role 서버만 기록·조회하고, 방문자의 개인정보는 저장하지 않는다.
create table if not exists marketing_link_clicks (
  id         uuid primary key default gen_random_uuid(),
  destination text not null check (destination in ('kakao')),
  source     text not null default 'unknown',
  medium     text not null default 'unknown',
  campaign   text not null default 'unknown',
  content    text not null default 'unknown',
  created_at timestamptz not null default now()
);

create index if not exists marketing_link_clicks_created_idx on marketing_link_clicks (created_at desc);
create index if not exists marketing_link_clicks_channel_idx on marketing_link_clicks (source, medium, campaign, content);
alter table marketing_link_clicks enable row level security;
revoke all on table marketing_link_clicks from anon, authenticated;
grant all on table marketing_link_clicks to service_role;
