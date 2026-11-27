import AdminTabs from '../AdminTabs';
import { redirect } from 'next/navigation';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { getHomepageVisitStats, listInquiries } from '@/lib/admin-data';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '상담 문의 · 어드민', robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await currentAdminIdentity())) redirect('/admin/login');
  const [inquiries, visitStats] = await Promise.all([listInquiries(), getHomepageVisitStats()]);

  return <main className={styles.page}>
    <header className={styles.topbar}><h1 className={styles.h1}>상담 문의</h1></header>
    <AdminTabs active="consultations" />
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>홈페이지 방문정보</h2>
      <div className={styles.visitMetrics}>
        <span><small>오늘</small><b>{visitStats.today.toLocaleString('ko-KR')}</b></span>
        <span><small>어제</small><b>{visitStats.yesterday.toLocaleString('ko-KR')}</b></span>
        <span><small>최근 7일</small><b>{visitStats.last7Days.toLocaleString('ko-KR')}</b></span>
      </div>
    </section>
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>상담 신청 내역 <em className={styles.countBadge}>{inquiries.length}</em></h2>
      {inquiries.length === 0 ? <p className={styles.empty}>신청 내역이 없습니다.</p> :
        <ul className={styles.inqList}>{inquiries.map(q =>
          <li key={q.id} className={styles.inq}>
            <div className={styles.inqHead}>
              <strong>{q.name}</strong>
              <span className={styles.inqContact}>{q.contact}</span>
              <span className={styles.dim}>{new Date(q.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
            </div>
            {q.message && <p className={styles.inqMsg}>{q.message}</p>}
          </li>
        )}</ul>}
    </section>
  </main>;
}
