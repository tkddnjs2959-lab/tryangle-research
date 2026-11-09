import styles from '../admin.module.css';

export default function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  return (
    <div className={styles.loginForm}>
      {googleEnabled ? (
        <a className={`${styles.btn} ${styles.googleBtn}`} href="/api/admin/google/start?mode=login">
          Google 계정으로 로그인
        </a>
      ) : (
        <p className={styles.error}>Google 관리자 로그인이 설정되지 않았습니다.</p>
      )}
    </div>
  );
}
