-- =====================================================================
--  홈페이지 상담 문의
--
--  홈페이지는 별도 Vercel 프로젝트로 배포하지만, DB는 이 프로젝트를
--  그대로 공유한다. 홈페이지 서버 라우트가 service_role 키로 여기에
--  쓰고, 어드민에서 그대로 확인한다 — 접근 원칙은 나머지 테이블과 동일:
--  브라우저는 DB에 직접 붙지 않는다.
-- =====================================================================

create table inquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null,            -- 전화번호 또는 카카오톡 ID 등, 형식 강제하지 않는다
  message    text,
  source     text not null default 'homepage',
  status     text not null default 'new'
             check (status in ('new','contacted','done','archived')),
  admin_memo text,
  created_at timestamptz not null default now()
);

create index inquiries_status_idx on inquiries (status, created_at desc);

comment on table inquiries is
  '홈페이지 상담 문의. 어드민에서만 열람 — RLS 는 켜져 있고 정책은 없다 (service_role 전용).';

alter table inquiries enable row level security;

-- ---------------------------------------------------------------------
-- 문의 등록 RPC
--   길이·필수값 검증을 DB에도 둔다. 홈페이지 쪽 코드가 바뀌어도
--   마지막 방어선이 남는다.
-- ---------------------------------------------------------------------
create or replace function submit_inquiry(
  p_name    text,
  p_contact text,
  p_message text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  rid uuid;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'P0010';
  end if;
  if btrim(coalesce(p_contact, '')) = '' then
    raise exception 'CONTACT_REQUIRED' using errcode = 'P0011';
  end if;
  if length(p_name) > 40 or length(p_contact) > 60 or length(coalesce(p_message,'')) > 1000 then
    raise exception 'TOO_LONG' using errcode = 'P0012';
  end if;

  insert into inquiries (name, contact, message)
  values (btrim(p_name), btrim(p_contact), nullif(btrim(coalesce(p_message,'')), ''))
  returning id into rid;

  return rid;
end $$;
