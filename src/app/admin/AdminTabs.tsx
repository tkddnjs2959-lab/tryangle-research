import Link from 'next/link';
import styles from './admin.module.css';

const tabs = [
  ['coaching', '/admin/coaching', '학생·등록'],
  ['schedule', '/admin/operations/schedule', '시간표·수업'],
  ['receipts', '/admin/operations/receipts', '수납·미수'],
  ['costs', '/admin/operations/costs', '비용·수익성'],
  ['closing', '/admin/operations/closing', '월 마감'],
  ['consultations', '/admin/inquiries', '상담문의'],
] as const;

export default function AdminTabs({ active }: { active: typeof tabs[number][0] | 'class' }) {
  return <nav className={styles.tabs} aria-label="관리 업무" style={{ flexWrap: 'wrap' }}>
    {tabs.map(([id, href, label]) => <Link key={id} href={href}
      aria-current={id === active ? 'page' : undefined}
      className={`${styles.tab} ${id === active ? styles.tabOn : ''}`}>{label}</Link>)}
  </nav>;
}

