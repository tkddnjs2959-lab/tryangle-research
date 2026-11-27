create table lesson_sessions (
 id uuid primary key default gen_random_uuid(),
 lesson_date date not null,
 start_time time not null,
 end_time time not null,
 teacher_name text not null check (length(trim(teacher_name)) between 1 and 100),
 student_id uuid not null references coaching_students(id) on delete cascade,
 created_at timestamptz not null default now(),
 constraint session_times check (end_time > start_time),
 unique (lesson_date, start_time, student_id)
);
create index lesson_sessions_date on lesson_sessions(lesson_date, start_time);
create index lesson_sessions_student on lesson_sessions(student_id);
alter table lesson_sessions enable row level security;
revoke all on lesson_sessions from anon, authenticated;