-- =====================================================================
--  문의 유입(UTM) 기록
--
--  홈페이지 쪽에서 만든 마이그레이션. 적용하면서 아래 drop 한 줄을 덧붙였다.
--
--  기존 submit_inquiry 는 인자가 3개고 새 정의는 7개(기본값 4개)라
--  create or replace 가 교체가 아니라 **오버로드**를 만든다. 그러면
--  인자 3개 호출이 두 함수 모두에 매칭되어
--    function submit_inquiry(...) is not unique
--  로 실패한다 — 즉 아직 배포되지 않은 구버전 홈페이지의 문의 접수가
--  마이그레이션을 적용하는 순간 깨진다.
--
--  옛 3인자 버전을 지우면 7인자 버전이 기본값으로 그 호출을 흡수하므로
--  구버전·신버전 홈페이지가 모두 정상 동작한다 (구버전은 유입이 unknown 으로 남는다).
--  덕분에 마이그레이션과 홈페이지 배포의 순서를 맞출 필요가 없다.
-- =====================================================================

alter table inquiries add column if not exists medium text not null default 'unknown';
alter table inquiries add column if not exists campaign text not null default 'unknown';
alter table inquiries add column if not exists content text not null default 'unknown';

create or replace function submit_inquiry(
  p_name text,
  p_contact text,
  p_message text default null,
  p_source text default 'homepage',
  p_medium text default 'unknown',
  p_campaign text default 'unknown',
  p_content text default 'unknown'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare rid uuid;
begin
  if btrim(coalesce(p_name, '')) = '' then raise exception 'NAME_REQUIRED' using errcode = 'P0010'; end if;
  if btrim(coalesce(p_contact, '')) = '' then raise exception 'CONTACT_REQUIRED' using errcode = 'P0011'; end if;
  if length(p_name) > 40 or length(p_contact) > 60 or length(coalesce(p_message,'')) > 1000 then
    raise exception 'TOO_LONG' using errcode = 'P0012';
  end if;
  insert into inquiries (name, contact, message, source, medium, campaign, content)
  values (btrim(p_name), btrim(p_contact), nullif(btrim(coalesce(p_message,'')), ''),
          left(coalesce(nullif(btrim(p_source), ''), 'unknown'), 100),
          left(coalesce(nullif(btrim(p_medium), ''), 'unknown'), 100),
          left(coalesce(nullif(btrim(p_campaign), ''), 'unknown'), 150),
          left(coalesce(nullif(btrim(p_content), ''), 'unknown'), 150))
  returning id into rid;
  return rid;
end $$;

-- 옛 3인자 버전을 반드시 지운다 (위 주석 참고).
drop function if exists submit_inquiry(text, text, text);
