-- 상담 개인정보와 제출 RPC는 서버의 service_role만 접근한다.
revoke all on table public.inquiries from anon, authenticated;
grant all on table public.inquiries to service_role;

revoke all on function public.submit_inquiry(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_inquiry(text, text, text, text, text, text, text) to service_role;
