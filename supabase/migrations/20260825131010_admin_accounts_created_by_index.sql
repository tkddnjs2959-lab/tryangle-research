create index if not exists admin_accounts_created_by_idx
  on public.admin_accounts (created_by)
  where created_by is not null;
