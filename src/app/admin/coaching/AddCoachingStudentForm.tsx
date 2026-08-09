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
      <h2 className={styles.blockTitle}>1:1 매체연기 코칭 학생 등록</h2>
      <p className={styles.blockHint}>연락처는 선택 입력입니다.</p>
      <form ref={ref} action={action} className={styles.addForm}>
        <input className={styles.input} name="name" placeholder="이름" required />
        <input className={styles.input} name="birthYear" placeholder="출생년도" inputMode="numeric" />
        <input className={styles.input} name="contact" placeholder="연락처 (선택)" />
        <select className={styles.input} name="gender" defaultValue="female">
          <option value="female">여</option>
          <option value="male">남</option>
        </select>
        <button className={styles.btn} type="submit" disabled={pending}>
          {pending ? '등록 중…' : '등록'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
