'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './admin.module.css';

const tabs = [
  ['schedule', '/admin/operations/schedule', '수업 시간표'],
  ['coaching', '/admin/coaching', '학생·등록'],
  ['calendar', '/admin/calendar', '상담·시작일 달력'],
  ['accounts', '/admin/accounts', '계정 관리'],
  ['receipts', '/admin/operations/receipts', '월 수납'],
  ['costs', '/admin/operations/costs', '비용·수익성'],
  ['closing', '/admin/operations/closing', '월 마감'],
  ['consultations', '/admin/inquiries', '상담문의'],
] as const;

export default function AdminTabs({ active }: { active: typeof tabs[number][0] | 'class' }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => setPendingHref(null), [pathname]);

  return <nav className={styles.tabs} aria-label="관리 업무" style={{ flexWrap: 'wrap' }}>
    {tabs.map(([id, href, label]) => <Link key={id} href={href}
      aria-current={id === active ? 'page' : undefined}
      aria-busy={pendingHref === href || undefined}
      onClick={() => { if (pathname !== href) setPendingHref(href); }}
      className={`${styles.tab} ${id === active ? styles.tabOn : ''} ${pendingHref === href ? styles.tabPending : ''}`}>{label}</Link>)}
  </nav>;
}

