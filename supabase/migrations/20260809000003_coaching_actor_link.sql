-- =====================================================================
--  퍼스널 브랜딩(actors) → 1:1 코칭(coaching_students) 연동
--
--  캐릭터 포지셔닝 클래스를 마친 배우가 1:1 코칭으로 넘어오는 흐름이 실제로
--  존재한다. 그동안 두 트랙이 완전히 분리돼 있어서 같은 사람을 코칭 탭에
--  손으로 다시 등록해야 했고, 리서치 결과를 코칭 쪽에서 볼 방법이 없었다.
--
--  actor_id 로 연결만 해둔다. 이름·생년 같은 값은 등록 시점에 복사하되,
--  연결이 살아 있으면 화면에서 배우 쪽 정보를 함께 보여준다.
--
--  on delete set null — 배우를 지워도 코칭 기록(메모·결제 이력)은 남아야 한다.
--  코칭 학생 한 명이 배우 두 명일 수는 없으므로 unique 를 건다.
-- =====================================================================

alter table coaching_students
  add column actor_id uuid references actors (id) on delete set null;

create unique index coaching_students_actor_id_key
    on coaching_students (actor_id)
 where actor_id is not null;
