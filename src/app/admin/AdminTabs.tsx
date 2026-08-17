import Link from 'next/link';
import styles from './admin.module.css';

type AdminTab = 'analytics' | 'class' | 'coaching' | 'consultations' | 'inquiries' | 'funnel' | 'marketing' | 'legacy-import';

export default function AdminTabs({ active }: { active: AdminTab }) {
  return <nav className={styles.tabs}>
    <Link href="/admin/analytics" className={`${styles.tab} ${active === 'analytics' ? styles.tabOn : ''}`}>통합 대시보드</Link>
    <Link href="/admin" className={`${styles.tab} ${active === 'class' ? styles.tabOn : ''}`}>클래스</Link>
    <Link href="/admin/coaching" className={`${styles.tab} ${active === 'coaching' ? styles.tabOn : ''}`}>1:1 코칭</Link>
    <Link href="/admin/consultations" className={`${styles.tab} ${active === 'consultations' ? styles.tabOn : ''}`}>상담 기록</Link>
    <Link href="/admin/inquiries" className={`${styles.tab} ${active === 'inquiries' ? styles.tabOn : ''}`}>상담 문의</Link>
    <Link href="/admin/funnel" className={`${styles.tab} ${active === 'funnel' ? styles.tabOn : ''}`}>등록·결제</Link>
    <Link href="/admin/marketing" className={`${styles.tab} ${active === 'marketing' ? styles.tabOn : ''}`}>광고비</Link>
    <Link href="/admin/legacy-import" className={`${styles.tab} ${active === 'legacy-import' ? styles.tabOn : ''}`}>이전 데이터</Link>
  </nav>;
}
