-- Legacy consultation/student notes are imported into staging first.
-- Nothing in this migration promotes a row into the operational CRM tables.
create table legacy_import_batches (
  id              uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_sha256   text not null,
  status          text not null default 'draft'
                  check (status in ('draft', 'reviewing', 'completed', 'cancelled')),
  row_count       int not null default 0,
  imported_by     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_sha256)
);

create table legacy_import_rows (
  id                 uuid primary key default gen_random_uuid(),
  batch_id           uuid not null references legacy_import_batches(id) on delete cascade,
  row_number         int not null,
  raw_text           text not null,
  record_kind        text not null default 'unknown'
                     check (record_kind in ('consultation', 'student_profile', 'unknown')),
  cohort_label       text,
  consulted_at       date,
  normalized_name    text,
  age                int,
  gender             text,
  experience         text,
  payment_note       text,
  candidate_actor_id uuid references actors(id) on delete set null,
  candidate_inquiry_id uuid references inquiries(id) on delete set null,
  match_status       text not null default 'unmatched'
                     check (match_status in ('unmatched', 'candidate', 'confirmed', 'rejected', 'needs_review')),
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index legacy_import_rows_batch_idx on legacy_import_rows (batch_id, row_number);
create index legacy_import_rows_match_idx on legacy_import_rows (match_status, normalized_name);
create index legacy_import_rows_actor_idx on legacy_import_rows (candidate_actor_id);

alter table legacy_import_batches enable row level security;
alter table legacy_import_rows enable row level security;
revoke all on table legacy_import_batches, legacy_import_rows from anon, authenticated;
grant all on table legacy_import_batches, legacy_import_rows to service_role;
