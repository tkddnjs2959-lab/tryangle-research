'use client';

import { useActionState, useRef } from 'react';
import { addCoachingStudent } from '../actions';
import styles from '../admin.module.css';

export default function AddCoachingStudentForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(
    async (prev: string | null, form: FormData) => {
      const res = await addCoachingStudent(prev, form);
      if (!res) ref.current?.reset();
      return res;
    },
    null
  );

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>매체연기 학생 등록</h2>
      <p className={styles.blockHint}>연락처는 선택 입력입니다.</p>
      <form ref={ref} action={action} className={styles.addForm}>
        <input className={styles.input} name="name" placeholder="이름" required />
        <input className={styles.input} name="birthYear" placeholder="출생년도" inputMode="numeric" />
        <input className={styles.input} name="contact" placeholder="연락처 (선택)" />
        <input className={styles.input} name="residence" placeholder="사는 곳 (예: 서울 성동구)" maxLength={120} />
        <select className={styles.input} name="gender" defaultValue="female">
          <option value="female">여</option>
          <option value="male">남</option>
        </select>
        <select className={styles.input} name="lessonPlan" defaultValue=""><option value="">수강 상품 선택</option><option value="one_lead">1:1 대표</option><option value="one_team">1:1 소속</option><option value="pair_once">2:1 주 1회</option><option value="pair_twice">2:1 주 2회</option></select>
        <input className={styles.input} name="monthlyTuition" type="number" min="0" step="1" placeholder="월 수강료 (원)" />
        <select className={styles.input} name="homeroomTeacher" defaultValue=""><option value="">담임 미배정</option><option>이주아 T</option><option>김유리 T</option></select>
        <button className={styles.btn} type="submit" disabled={pending}>
          {pending ? '등록 중…' : '등록'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
