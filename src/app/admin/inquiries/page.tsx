import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listInquiries, type InquiryStatus } from '@/lib/admin-data';
import { changeInquiryStatus, removeInquiry } from '../actions';
import ConfirmButton from '../ConfirmButton';
import styles from '../admin.module.css';
import AdminTabs from '../AdminTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: '상담 문의 · 어드민', robots: { index: false, follow: false } };

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: '신규',
  contacted: '연락함',
  done: '완료',
  archived: '보류',
};

export default async function Page() {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const inquiries = await listInquiries();
  const open = inquiries.filter((i) => i.status !== 'archived' && i.status !== 'done');
  const closed = inquiries.filter((i) => i.status === 'archived' || i.status === 'done');

  // 어느 경로로 들어온 문의가 많은지 — 광고를 어디에 쓸지 판단하는 근거가 된다.
  const bySource = new Map<string, number>();
  for (const q of inquiries) {
    const key = q.source || 'unknown';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  const sourceRank = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <Link href="/admin" className={styles.back}>
            ← 캐릭터포지셔닝 관리
          </Link>
          <h1 className={styles.h1}>상담 문의</h1>
          <div className={styles.meta}>홈페이지 문의 폼으로 들어온 내용입니다</div>
        </div>
        <div className={styles.topbarActions}><a href="/api/admin/inquiries/export" className={`${styles.btn} ${styles.ghost}`}>CSV 내보내기</a></div>
      </header>

      <AdminTabs active="inquiries" />

      {sourceRank.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>유입 경로</h2>
          <p className={styles.blockHint}>
            전체 문의 {inquiries.length}건 기준입니다. 광고를 어디에 쓸지 판단하는 근거가 됩니다.
          </p>
          <div className={styles.summary}>
            {sourceRank.map(([src, n]) => (
              <span key={src} className={styles.summaryItem}>
                {src} <b>{n}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>
          진행 중 <em className={styles.countBadge}>{open.length}</em>
        </h2>
        {open.length === 0 ? (
          <p className={styles.empty}>진행 중인 문의가 없습니다.</p>
        ) : (
          <ul className={styles.inqList}>
            {open.map((q) => (
              <InquiryRow key={q.id} q={q} />
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>완료 · 보류</h2>
          <ul className={styles.inqList}>
            {closed.map((q) => (
              <InquiryRow key={q.id} q={q} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function InquiryRow({
  q,
}: {
  q: Awaited<ReturnType<typeof listInquiries>>[number];
}) {
  return (
    <li className={`${styles.inq} ${styles['inq_' + q.status]}`}>
      <div className={styles.inqHead}>
        <strong>{q.name}</strong>
        <span className={styles.inqContact}>{q.contact}</span>
        <span className={styles.dim}>{new Date(q.createdAt).toLocaleString('ko-KR')}</span>
        <span className={styles.statusTag}>{STATUS_LABEL[q.status]}</span>
      </div>
      <div className={styles.inqSource}>
        <span className={styles.srcTag}>{q.source || 'unknown'}</span>
        {q.medium && <span className={styles.srcTag}>{q.medium}</span>}
        {q.campaign && <span className={styles.srcTag}>{q.campaign}</span>}
        {q.content && <span className={styles.srcTag}>{q.content}</span>}
      </div>
      {q.message && <p className={styles.inqMsg}>{q.message}</p>}
      <div className={styles.inqActions}>
        <form action={changeInquiryStatus} className={styles.inqForm}>
          <input type="hidden" name="id" value={q.id} />
          <select name="status" defaultValue={q.status} className={styles.input}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">
            상태 변경
          </button>
        </form>
        <form action={removeInquiry}>
          <input type="hidden" name="id" value={q.id} />
          <ConfirmButton
            className={styles.del}
            message={`${q.name} 님의 문의를 삭제합니다. 되돌릴 수 없습니다.`}
          >
            삭제
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}
