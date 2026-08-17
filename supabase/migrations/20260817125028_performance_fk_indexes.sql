create index if not exists checkout_orders_actor_idx
  on public.checkout_orders (actor_id);

create index if not exists legacy_import_rows_candidate_inquiry_idx
  on public.legacy_import_rows (candidate_inquiry_id);

create index if not exists response_keywords_keyword_idx
  on public.response_keywords (keyword_id);
