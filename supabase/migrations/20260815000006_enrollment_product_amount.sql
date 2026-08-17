alter table enrollments add column if not exists product_name text;
alter table enrollments add column if not exists amount numeric(12, 2) check (amount is null or amount >= 0);
