-- 상담 기록·클로바노트 텍스트·AI 분석·후속 조치
--
-- 운영 DB에 먼저 적용된 상담 CRM 스키마를 저장소의 migration 이력으로 복구한다.
-- 현재 단계에서는 어드민 서버(service_role)만 접근하며, 브라우저용 정책은 만들지 않는다.

create table consultation_sessions (
  id                  uuid primary key default gen_random_uuid(),
  actor_id            uuid not null references actors(id) on delete cascade,
  consulted_at        timestamptz not null,
  consultation_type   text not null default 'general',
  duration_seconds    int,
  counselor_name      text,
  source              text not null default 'manual'
                      check (source in ('manual', 'clova_note_import', 'clova_speech')),
  status              text not null default 'draft'
                      check (status in ('draft', 'transcribing', 'analyzing', 'reviewed', 'archived')),
  recording_path      text,
  consent_obtained_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table consultation_transcripts (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references consultation_sessions(id) on delete cascade,
  full_text        text not null,
  segments         jsonb,
  speaker_map       jsonb,
  language         text not null default 'ko-KR',
  stt_provider     text,
  provider_job_id  text,
  raw_result       jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table consultation_analyses (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references consultation_sessions(id) on delete cascade,
  model            text not null,
  prompt_version   text not null,
  analysis_version int not null default 1,
  summary          text,
  structured_result jsonb not null,
  input_hash       text not null,
  token_usage      jsonb,
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'failed')),
  reviewed_at      timestamptz,
  reviewed_by      text,
  created_at       timestamptz not null default now()
);

create table consultation_action_items (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references consultation_sessions(id) on delete cascade,
  actor_id     uuid not null references actors(id) on delete cascade,
  title        text not null,
  description  text,
  assignee     text,
  due_at       timestamptz,
  status       text not null default 'todo'
               check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table consultation_sessions enable row level security;
alter table consultation_transcripts enable row level security;
alter table consultation_analyses enable row level security;
alter table consultation_action_items enable row level security;

revoke all on table consultation_sessions, consultation_transcripts,
  consultation_analyses, consultation_action_items from anon, authenticated;
grant all on table consultation_sessions, consultation_transcripts,
  consultation_analyses, consultation_action_items to service_role;
