-- 관리자 인증 수단과 실제 권한을 분리한다.
-- 카카오/구글 OAuth는 추후 연결하되, 허용 목록에 미리 등록된 계정만
-- 관리자 세션을 만들 수 있도록 서버 전용 계정 저장소를 먼저 준비한다.

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_provider text not null
    check (auth_provider in ('password', 'kakao', 'google')),
  provider_subject_hash text not null,
  display_label text not null,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.admin_accounts(id) on delete set null,
  unique (auth_provider, provider_subject_hash),
  check (active or revoked_at is not null)
);

comment on table public.admin_accounts is
  '서버 전용 관리자 허용 목록. OAuth 공급자의 원본 사용자 ID는 저장하지 않고 비밀키 기반 해시만 저장한다.';

create index if not exists admin_accounts_active_provider_idx
  on public.admin_accounts (auth_provider, active)
  where active = true and revoked_at is null;

alter table public.admin_accounts enable row level security;
revoke all on table public.admin_accounts from anon, authenticated;
grant select, insert, update, delete on table public.admin_accounts to service_role;

alter table public.admin_sessions
  add column if not exists admin_account_id uuid
    references public.admin_accounts(id) on delete cascade,
  add column if not exists auth_provider text,
  add column if not exists role_snapshot text;

create index if not exists admin_sessions_account_active_idx
  on public.admin_sessions (admin_account_id, expires_at)
  where revoked_at is null;

alter table public.admin_audit_log
  add column if not exists admin_account_id uuid
    references public.admin_accounts(id) on delete set null;

create index if not exists admin_audit_log_account_idx
  on public.admin_audit_log (admin_account_id, created_at desc)
  where admin_account_id is not null;
