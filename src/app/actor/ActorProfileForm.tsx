'use client';

import { useActionState } from 'react';
import { saveActorProfile } from './actions';
import styles from './page.module.css';

export default function ActorProfileForm({
  name,
  phone,
  memo,
}: {
  name: string;
  phone: string;
  memo: string;
}) {
  const [error, action, pending] = useActionState(saveActorProfile, null);

  return (
    <form action={action} className={styles.form}>
      <label className={styles.label}>
        이름
        <input name="name" className={styles.input} defaultValue={name} placeholder="배우 이름" />
      </label>
      <label className={styles.label}>
        연락처
        <input name="phone" className={styles.input} defaultValue={phone} placeholder="010-0000-0000" />
      </label>
      <label className={styles.label}>
        메모
        <textarea
          name="memo"
          className={styles.textarea}
          defaultValue={memo}
          placeholder="추가로 남기고 싶은 내용이 있으면 적어주세요."
          rows={4}
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.btn} type="submit" disabled={pending}>
        {pending ? '저장 중...' : '정보 저장'}
      </button>
    </form>
  );
}
