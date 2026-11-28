create table if not exists public.trainer_accounts (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  display_name text not null,
  teacher_name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.trainer_sessions (
  token_hash text primary key,
  account_id uuid not null references public.trainer_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists trainer_sessions_account_idx on public.trainer_sessions(account_id);
create table if not exists public.trainer_tuition_audit (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.coaching_students(id),
  service_month date not null,
  old_paid_date date,
  new_paid_date date,
  trainer_account_id uuid not null references public.trainer_accounts(id),
  changed_at timestamptz not null default now()
);
alter table public.trainer_accounts enable row level security;
alter table public.trainer_sessions enable row level security;
alter table public.trainer_tuition_audit enable row level security;
revoke all on public.trainer_accounts, public.trainer_sessions, public.trainer_tuition_audit from anon, authenticated;
