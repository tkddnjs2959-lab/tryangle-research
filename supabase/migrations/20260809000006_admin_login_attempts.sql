-- =====================================================================
--  어드민 로그인 시도 제한
--
--  배포하면 /admin/login 이 공개 인터넷에 노출된다. 로그인은 비밀번호
--  하나뿐이라 시도 제한이 없으면 무차별 대입을 막을 방법이 없다.
--
--  Vercel 은 서버리스라 프로세스 메모리에 카운트를 들고 있을 수 없다
--  (요청마다 다른 인스턴스일 수 있고 금방 사라진다). 그래서 테이블에 둔다.
--
--  IP 는 x-forwarded-for 에서 얻는다. 위조가 가능하지만, 위조하려면
--  매 요청 IP 를 바꿔야 해서 단순 대입 공격의 비용은 충분히 올라간다.
-- =====================================================================

create table admin_login_attempts (
  ip            text primary key,
  fails         int not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

alter table admin_login_attempts enable row level security;
-- 정책 없음 — service_role 만 접근한다.
