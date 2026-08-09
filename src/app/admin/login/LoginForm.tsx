'use client';

import { useActionState } from 'react';
import { login } from '../actions';
import styles from '../admin.module.css';

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className={styles.loginForm}>
      <input
        className={styles.input}
        type="password"
        name="password"
        placeholder="비밀번호"
        autoComplete="current-password"
        autoFocus
      />
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.btn} type="submit" disabled={pending}>
        {pending ? '확인 중…' : '로그인'}
      </button>
    </form>
  );
}
