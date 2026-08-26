'use client';

import { useActionState } from 'react';
import { completeGoogleLogin, login } from '../actions';
import styles from '../admin.module.css';

export default function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className={styles.loginForm}>
      <input
        className={styles.input}
        type="text"
        name="adminId"
        placeholder="관리자 아이디"
        autoComplete="username"
        required
        autoFocus
      />
      <input
        className={styles.input}
        type="password"
        name="password"
        placeholder="비밀번호"
        autoComplete="current-password"
        required
      />
      <input
        className={styles.input}
        type="text"
        inputMode="numeric"
        name="totp"
        placeholder="인증 앱 6자리 번호"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
      />
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.btn} type="submit" disabled={pending}>
        {pending ? '확인 중…' : '로그인'}
      </button>
      {googleEnabled && (
        <>
          <div className={styles.loginDivider}><span>또는</span></div>
          <a className={`${styles.btn} ${styles.googleBtn}`} href="/api/admin/google/start?mode=login">
            Google 계정으로 로그인
          </a>
        </>
      )}
    </form>
  );
}

export function GoogleMfaForm() {
  const [error, action, pending] = useActionState(completeGoogleLogin, null);
  return (
    <form action={action} className={styles.loginForm}>
      <p className={styles.loginNotice}>Google 계정 확인이 완료되었습니다. 인증 앱의 6자리 번호를 입력해주세요.</p>
      <input className={styles.input} type="text" inputMode="numeric" name="totp" placeholder="인증 앱 6자리 번호" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus />
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.btn} type="submit" disabled={pending}>{pending ? '확인 중…' : '로그인 완료'}</button>
      <a className={styles.loginCancel} href="/admin/login">처음으로</a>
    </form>
  );
}
