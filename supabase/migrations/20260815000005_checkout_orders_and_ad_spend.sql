-- PG 결제창과 광고비 원장. 실제 PG 연동 전에도 주문·웹훅 상태를 안전하게 저장한다.

create table if not exists checkout_orders (
  id                   uuid primary key default gen_random_uuid(),
  enrollment_id        uuid references enrollments(id) on delete set null,
  actor_id             uuid references actors(id) on delete set null,
  order_id             text not null unique,
  provider             text not null,
  provider_payment_key text,
  order_name           text not null,
  amount               numeric(12, 2) not null check (amount >= 0),
  currency             text not null default 'KRW',
  status               text not null default 'ready'
                       check (status in ('ready', 'pending', 'paid', 'cancelled', 'failed', 'refunded')),
  customer_name        text,
  customer_email       text,
  customer_phone       text,
  raw_response         jsonb,
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  updated_at           timestamptz not null default now()
);

create table if not exists marketing_spend_daily (
  id            uuid primary key default gen_random_uuid(),
  spend_date    date not null,
  platform      text not null,
  account_name  text,
  campaign      text,
  spend         numeric(12, 2) not null check (spend >= 0),
  impressions   integer check (impressions >= 0),
  clicks        integer check (clicks >= 0),
  note          text,
  created_at    timestamptz not null default now(),
  unique (spend_date, platform, campaign)
);

create index if not exists checkout_orders_enrollment_idx on checkout_orders (enrollment_id);
create index if not exists checkout_orders_status_idx on checkout_orders (status, created_at);
create index if not exists marketing_spend_date_idx on marketing_spend_daily (spend_date);
create index if not exists marketing_spend_campaign_idx on marketing_spend_daily (platform, campaign, spend_date);

alter table checkout_orders enable row level security;
alter table marketing_spend_daily enable row level security;
revoke all on table checkout_orders, marketing_spend_daily from anon, authenticated;
grant all on table checkout_orders, marketing_spend_daily to service_role;
