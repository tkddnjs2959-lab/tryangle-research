-- These tables contain administrator sessions, contact details, notification
-- tokens, or consultation records. Public routes only access them through a
-- server-only service_role client.

revoke all privileges on table
  public.admin_accounts,
  public.admin_audit_log,
  public.admin_login_attempts,
  public.admin_sessions,
  public.analytics_events,
  public.analytics_sessions,
  public.consultation_action_items,
  public.consultation_analyses,
  public.consultation_sessions,
  public.consultation_transcripts,
  public.inquiries,
  public.inquiry_rate_limits,
  public.inquiry_security_events,
  public.inquiry_submission_claims,
  public.kakao_token
from anon, authenticated;

revoke execute on function public.consume_inquiry_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.submit_inquiry(
  text, text, text, text, text, text, text, uuid, boolean, uuid, text
) from public, anon, authenticated;

grant select, insert, update, delete on table
  public.admin_accounts,
  public.admin_audit_log,
  public.admin_login_attempts,
  public.admin_sessions,
  public.analytics_events,
  public.analytics_sessions,
  public.consultation_action_items,
  public.consultation_analyses,
  public.consultation_sessions,
  public.consultation_transcripts,
  public.inquiries,
  public.inquiry_rate_limits,
  public.inquiry_security_events,
  public.inquiry_submission_claims,
  public.kakao_token
to service_role;

grant execute on function public.consume_inquiry_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.submit_inquiry(
  text, text, text, text, text, text, text, uuid, boolean, uuid, text
) to service_role;
