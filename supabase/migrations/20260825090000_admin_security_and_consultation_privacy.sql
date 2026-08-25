-- 관리자 세션을 서버에서 폐기할 수 있게 하고 상담 원문 보관 정책을 강화한다.

create table if not exists admin_sessions (
  token_hash text primary key,
  admin_id text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text
);

create index if not exists admin_sessions_active_idx
  on admin_sessions (expires_at)
  where revoked_at is null;

alter table admin_sessions enable row level security;
grant select, insert, update, delete on table admin_sessions to service_role;

alter table admin_audit_log
  add column if not exists admin_id text;

alter table consultation_sessions
  add column if not exists inquiry_id uuid references inquiries(id) on delete set null,
  add column if not exists consent_policy_version text not null default '2026-08-v1',
  add column if not exists retention_until timestamptz,
  add column if not exists recording_deleted_at timestamptz;

create index if not exists consultation_sessions_inquiry_idx
  on consultation_sessions (inquiry_id)
  where inquiry_id is not null;

alter table consultation_transcripts
  add column if not exists encrypted_text text,
  add column if not exists encryption_iv text,
  add column if not exists encryption_tag text,
  add column if not exists encryption_version text,
  add column if not exists redaction_reviewed_at timestamptz,
  add column if not exists retention_until timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists consultation_transcripts_retention_idx
  on consultation_transcripts (retention_until)
  where deleted_at is null and retention_until is not null;

comment on column consultation_transcripts.full_text is
  '암호화 적용 후에는 평문 대신 [encrypted:v1] 표식만 저장한다.';
