create index if not exists inquiry_submission_claims_inquiry_idx
  on public.inquiry_submission_claims (inquiry_id)
  where inquiry_id is not null;
