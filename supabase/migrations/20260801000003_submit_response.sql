-- =====================================================================
--  응답 제출 RPC
--
--  응답 1건은 responses + response_keywords 두 테이블에 걸쳐 저장된다.
--  앱에서 두 번 호출하면 중간에 실패했을 때 키워드 없는 빈 응답이 남는다.
--  한 함수 안에서 처리해 원자성을 확보한다.
--
--  검증도 여기서 한다. 앱 코드가 바뀌어도 DB가 마지막 방어선이 된다.
--    - 잠김 / 마감 / 정원 초과
--    - 이 리서치·성별에 속하지 않는 키워드 (링크를 뜯어고쳐 보내는 경우)
--    - 빈 제출
--
--  중복 제출은 여기서 막지 않는다.
--  IP+UA 해시는 같은 집 WiFi에 같은 기종을 쓰는 가족이 겹칠 수 있어
--  선의의 응답자를 막아버린다. 대신 라우트에서 쿠키로 막고,
--  device_hash 는 어드민이 의심 사례를 눈으로 확인하는 용도로만 남긴다.
-- =====================================================================

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
  select sv.id, sv.type, sv.locked, sv.closes_at, sv.cap_n, a.gender
    into s
  from surveys sv
  join actors a on a.id = sv.actor_id
  where sv.token = p_token;

  if not found then
    raise exception 'SURVEY_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 잠김 / 마감 / 정원
  select count(*) into cnt from responses where survey_id = s.id;
  if s.locked
     or (s.closes_at is not null and s.closes_at <= now())
     or (s.cap_n is not null and cnt >= s.cap_n) then
    raise exception 'SURVEY_CLOSED' using errcode = 'P0001';
  end if;

  -- 빈 제출
  if coalesce(array_length(p_keyword_ids, 1), 0)
   + coalesce(array_length(p_custom, 1), 0) = 0 then
    raise exception 'EMPTY_SUBMISSION' using errcode = 'P0005';
  end if;

  -- 셀프 체크는 이미지·퍼스널리티 두 표를 모두 쓴다
  if s.type = 'self' then
    allowed := array['image','personality']::research_category[];
  else
    allowed := array[s.type];
  end if;

  -- 이 리서치에 속하지 않는 키워드가 섞여 있는지
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

comment on function submit_response is
  '응답 제출. 잠금·정원·키워드 소속을 검증하고 원자적으로 저장한다.';
