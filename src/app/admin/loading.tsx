import styles from './admin.module.css';

export default function AdminLoading() {
  return (
    <main className={styles.page} aria-live="polite" aria-busy="true">
      <p className={styles.empty}>관리 화면을 불러오는 중입니다.</p>
    </main>
  );
}
