-- 운영 DB에 먼저 만들어진 상담 테이블의 브라우저 역할 접근을 명시적으로 차단한다.

revoke all on table consultation_sessions, consultation_transcripts,
  consultation_analyses, consultation_action_items from anon, authenticated;
grant all on table consultation_sessions, consultation_transcripts,
  consultation_analyses, consultation_action_items to service_role;
