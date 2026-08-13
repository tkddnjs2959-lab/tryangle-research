-- 상담 세션 삭제·조회를 위한 외래키 인덱스
create index consultation_action_items_session_idx
  on consultation_action_items (session_id);
