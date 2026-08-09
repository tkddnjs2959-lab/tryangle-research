import Link from 'next/link';
import styles from './admin.module.css';

export default function AdminTabs({ active }: { active: 'class' | 'coaching' }) {
  return (
    <nav className={styles.tabs}>
      <Link href="/admin" className={`${styles.tab} ${active === 'class' ? styles.tabOn : ''}`}>
        기수별 (캐릭터 포지셔닝 클래스)
      </Link>
      <Link
        href="/admin/coaching"
        className={`${styles.tab} ${active === 'coaching' ? styles.tabOn : ''}`}
      >
        1:1 매체연기
      </Link>
    </nav>
  );
}
