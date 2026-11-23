alter table public.coaching_students
  add column if not exists residence text;

comment on column public.coaching_students.residence is '�л��� �Է��� ���� ����';
