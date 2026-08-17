-- 상담을 아직 배우로 등록하지 않은 홈페이지 문의자에게도 연결한다.

alter table consultation_sessions
  alter column actor_id drop not null;

alter table consultation_sessions
  add column inquiry_id uuid references inquiries(id) on delete set null;

alter table consultation_sessions
  add constraint consultation_sessions_subject_check
  check (actor_id is not null or inquiry_id is not null);

alter table consultation_action_items
  alter column actor_id drop not null;

create index consultation_sessions_inquiry_idx
  on consultation_sessions (inquiry_id, consulted_at desc);
