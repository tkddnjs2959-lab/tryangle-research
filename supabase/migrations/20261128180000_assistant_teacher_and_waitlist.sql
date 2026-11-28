alter table public.coaching_students
  add column if not exists assistant_teacher text
  constraint coaching_students_assistant_teacher_check
  check (assistant_teacher in ('이주아 T', '김유리 T'));

alter table public.coaching_students drop constraint if exists coaching_students_status_check;
alter table public.coaching_students add constraint coaching_students_status_check
  check (status in ('active', 'waitlist', 'unregistered', 'leave', 'withdrawn', 'done', 'archived', 'prospective'));
