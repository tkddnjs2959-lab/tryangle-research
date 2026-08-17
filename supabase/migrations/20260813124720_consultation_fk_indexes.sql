-- 상담 CRM 조회용 인덱스

create index consultation_sessions_actor_idx
  on consultation_sessions (actor_id, consulted_at desc);

create index consultation_transcripts_session_idx
  on consultation_transcripts (session_id);

create index consultation_analyses_session_idx
  on consultation_analyses (session_id, created_at desc);

create unique index consultation_analyses_version_idx
  on consultation_analyses (session_id, analysis_version);

create index consultation_action_items_session_idx
  on consultation_action_items (session_id);

create index consultation_action_items_actor_idx
  on consultation_action_items (actor_id, status, due_at);
