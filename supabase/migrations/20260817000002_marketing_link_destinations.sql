-- 홈페이지 광고 유입도 같은 클릭 원장에서 집계한다.
alter table public.marketing_link_clicks drop constraint if exists marketing_link_clicks_destination_check;
alter table public.marketing_link_clicks add constraint marketing_link_clicks_destination_check check (destination in ('homepage', 'kakao'));
