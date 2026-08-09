'use client';

import { useActionState, useRef } from 'react';
import { addActor } from './actions';
import styles from './admin.module.css';

export default function AddActorForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(
    async (prev: string | null, form: FormData) => {
      const res = await addActor(prev, form);
      if (!res) ref.current?.reset();
      return res;
    },
    null
  );

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>배우 등록</h2>
      <p className={styles.blockHint}>
        등록하면 리서치 3건과 링크 4개가 자동으로 발급됩니다.
      </p>
      <form ref={ref} action={action} className={styles.addForm}>
        <input className={styles.input} name="name" placeholder="이름" required />
        <input className={styles.input} name="birthYear" placeholder="출생년도" inputMode="numeric" />
        <input className={styles.input} name="cohort" placeholder="기수 (선택)" />
        <select className={styles.input} name="gender" defaultValue="female">
          <option value="female">여자 ver</option>
          <option value="male">남자 ver</option>
        </select>
        <button className={styles.btn} type="submit" disabled={pending}>
          {pending ? '등록 중…' : '등록'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
