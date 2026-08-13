-- 상담 CRM: 원문, 분석 버전, 후속 조치를 기존 actors와 분리해 저장한다.
create table consultation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references actors(id) on delete cascade,
  consulted_at timestamptz not null,
  consultation_type text not null default 'general',
  duration_seconds int,
  counselor_name text,
  source text not null default 'manual' check (source in ('manual', 'clova_note_import', 'clova_speech')),
  status text not null default 'draft' check (status in ('draft', 'transcribing', 'analyzing', 'reviewed', 'archived')),
  recording_path text,
  consent_obtained_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consultation_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references consultation_sessions(id) on delete cascade,
  full_text text not null,
  segments jsonb,
  speaker_map jsonb,
  language text not null default 'ko-KR',
  stt_provider text,
  provider_job_id text,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consultation_analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references consultation_sessions(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  analysis_version int not null default 1,
  summary text,
  structured_result jsonb not null,
  input_hash text not null,
  token_usage jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create table consultation_action_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references consultation_sessions(id) on delete cascade,
  actor_id uuid not null references actors(id) on delete cascade,
  title text not null,
  description text,
  assignee text,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consultation_sessions_actor_idx on consultation_sessions (actor_id, consulted_at desc);
create index consultation_transcripts_session_idx on consultation_transcripts (session_id);
create index consultation_analyses_session_idx on consultation_analyses (session_id, created_at desc);
create index consultation_action_items_actor_idx on consultation_action_items (actor_id, status, due_at);
create unique index consultation_analyses_version_idx on consultation_analyses (session_id, analysis_version);

alter table consultation_sessions enable row level security;
alter table consultation_transcripts enable row level security;
alter table consultation_analyses enable row level security;
alter table consultation_action_items enable row level security;
-- 정책 없음: 서버 service_role만 접근한다.

-- 2026년 이후 생성 프로젝트는 public 테이블이 Data API에 자동 노출되지 않을 수 있다.
-- 이 CRM은 서버의 service_role 클라이언트만 사용한다.
grant select, insert, update, delete on table
  consultation_sessions,
  consultation_transcripts,
  consultation_analyses,
  consultation_action_items
to service_role;
