alter table coaching_students add column monthly_tuition integer check (monthly_tuition >= 0);
alter table lesson_sessions add column tuition_amount integer check (tuition_amount >= 0);
alter table lesson_sessions add column tuition_session_count integer check (tuition_session_count in (4,8));
create or replace function public.snapshot_lesson_tuition() returns trigger language plpgsql set search_path = public as $$
begin
  select monthly_tuition, case when lesson_plan = 'pair_twice' then 8 when lesson_plan in ('one_lead','one_team','pair_once') then 4 end
  into new.tuition_amount, new.tuition_session_count from coaching_students where id = new.student_id;
  return new;
end;
$$;
create trigger lesson_tuition_snapshot before insert on lesson_sessions for each row execute function public.snapshot_lesson_tuition();