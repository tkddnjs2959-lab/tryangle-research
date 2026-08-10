-- =====================================================================
--  응답 소프트 삭제 + 어드민 변경 이력
--
--  1) 응답 삭제가 완전 삭제였다. 중복 응답을 지우려다 잘못 누르면 복구할
--     방법이 없다. deleted_at 을 찍고 화면에서 감추는 방식으로 바꾼다.
--
--     주의: 집계가 걸린 곳을 전부 같이 고쳐야 한다.
--       - survey_progress 뷰의 count
--       - submit_response 의 정원(cap_n) 계산
--     하나라도 빠뜨리면 지운 응답이 숫자에는 남아 최소 인원이 부풀려진다.
--
--  2) 누가 언제 무엇을 했는지 기록이 없었다. 대표 혼자 쓰더라도
--     "아까 내가 뭘 눌렀지" 를 되짚을 수 있어야 한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 응답 소프트 삭제
-- ---------------------------------------------------------------------
alter table responses add column deleted_at timestamptz;

-- 살아있는 응답만 빠르게 세기 위한 부분 인덱스
create index responses_alive_idx on responses (survey_id) where deleted_at is null;

-- 진행 현황 뷰 — 지운 응답은 숫자에서 빠져야 한다.
create or replace view survey_progress as
select
  s.id,
  s.actor_id,
  s.type,
  s.token,
  s.min_n,
  s.cap_n,
  s.locked,
  s.closes_at,
  count(r.id)::int as n,
  (count(r.id) >= s.min_n) as met,
  (
    not s.locked
    and (s.closes_at is null or s.closes_at > now())
    and (s.cap_n is null or count(r.id) < s.cap_n)
  ) as is_open
from surveys s
left join responses r on r.survey_id = s.id and r.deleted_at is null
group by s.id;

alter view survey_progress set (security_invoker = on);

comment on view survey_progress is
  '진행 현황 전용. 응답 내용(키워드)은 이 뷰를 통해 새어나갈 수 없다. 삭제된 응답은 제외한다.';

-- 정원 계산에서도 지운 응답을 빼야 한다.
-- 시그니처는 원본과 한 글자도 다르면 안 된다 (p_device_hash 의 default 포함).
-- 기본값을 빼면 "cannot remove parameter defaults from existing function" 으로 실패한다.
create or replace function submit_response(
  p_token       text,
  p_keyword_ids int[],
  p_custom      text[],
  p_device_hash text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  s       record;
  cnt     int;
  bad     int;
  rid     uuid;
  allowed research_category[];
begin
  select sv.id, sv.actor_id, sv.type, sv.locked, sv.closes_at, sv.cap_n, a.gender
    into s
    from surveys sv
    join actors a on a.id = sv.actor_id
   where sv.token = p_token;

  if not found then
    raise exception 'SURVEY_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 잠김 / 마감 / 정원 (삭제된 응답은 정원에서 제외)
  select count(*) into cnt from responses
   where survey_id = s.id and deleted_at is null;
  if s.locked
     or (s.closes_at is not null and s.closes_at <= now())
     or (s.cap_n is not null and cnt >= s.cap_n) then
    raise exception 'SURVEY_CLOSED' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_keyword_ids, 1), 0)
   + coalesce(array_length(p_custom, 1), 0) = 0 then
    raise exception 'EMPTY_SUBMISSION' using errcode = 'P0005';
  end if;

  if s.type = 'self' then
    allowed := array['image','personality']::research_category[];
  else
    allowed := array[s.type];
  end if;

  select count(*) into bad
  from unnest(coalesce(p_keyword_ids, '{}')) kid
  where not exists (
    select 1 from keywords k
    where k.id = kid
      and k.gender = s.gender
      and k.active
      and k.category = any(allowed)
  );
  if bad > 0 then
    raise exception 'INVALID_KEYWORD' using errcode = 'P0004';
  end if;

  insert into responses (survey_id, device_hash)
  values (s.id, p_device_hash)
  returning id into rid;

  insert into response_keywords (response_id, keyword_id)
  select rid, x from unnest(coalesce(p_keyword_ids, '{}')) x
  on conflict do nothing;

  insert into response_keywords (response_id, custom_label)
  select rid, btrim(x) from unnest(coalesce(p_custom, '{}')) x
  where btrim(x) <> ''
  on conflict do nothing;

  return rid;
end $$;

-- ---------------------------------------------------------------------
-- 2) 어드민 변경 이력
--
-- 지금은 어드민 계정이 하나뿐이라 '누가' 를 남길 수 없다. 계정을 나누게
-- 되면 actor_by 컬럼을 추가한다. 그때까지는 '무엇을 언제' 만 남긴다.
-- ---------------------------------------------------------------------
create table admin_audit_log (
  id          bigserial primary key,
  action      text not null,           -- 'week_open' | 'response_delete' | ...
  target_type text,                    -- 'actor' | 'cohort' | 'response' | ...
  target_id   text,                    -- uuid 든 기수 이름이든 문자열로
  summary     text not null,           -- 사람이 읽는 한 줄
  detail      jsonb,                   -- 되돌리는 데 필요한 값
  created_at  timestamptz not null default now()
);

create index admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index admin_audit_log_target_idx  on admin_audit_log (target_type, target_id, created_at desc);

alter table admin_audit_log enable row level security;
-- 정책 없음 — service_role 만 접근한다.
