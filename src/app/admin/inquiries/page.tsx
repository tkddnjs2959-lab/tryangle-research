import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listInquiries, type InquiryStatus } from '@/lib/admin-data';
import { clarityReport } from '@/lib/clarity-report';
import { changeInquiryStatus, removeInquiry, saveInquiryMemo } from '../actions';
import ConfirmButton from '../ConfirmButton';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '상담 문의 · 어드민', robots: { index: false, follow: false } };

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: '신규',
  contacted: '연락함',
  done: '완료',
  archived: '보류',
};

function rate(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '-';
}

function memoHas(memo: string | null, field: string, value: string) {
  return new RegExp(`${field}\\s*:\\s*${value}(?:\\s|\\||$)`, 'i').test(memo ?? '');
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; view?: string }>;
}) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const [allInquiries, params] = await Promise.all([listInquiries(), searchParams]);
  const days = ['7', '30'].includes(params.days ?? '') ? Number(params.days) : null;
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
  const periodInquiries = cutoff
    ? allInquiries.filter((inquiry) => new Date(inquiry.createdAt).getTime() >= cutoff)
    : allInquiries;
  const view = ['open', 'followup', 'priority'].includes(params.view ?? '') ? params.view : 'all';
  const filteredInquiries = view === 'open'
    ? periodInquiries.filter((inquiry) => inquiry.status !== 'done' && inquiry.status !== 'archived')
    : view === 'followup'
      ? periodInquiries.filter((inquiry) => Boolean(inquiry.adminMemo?.trim()))
      : periodInquiries;
  const priority = { new: 0, contacted: 1, done: 2, archived: 3 };
  const inquiries = view === 'priority'
    ? periodInquiries
      .filter((inquiry) => inquiry.status !== 'done' && inquiry.status !== 'archived')
      .sort((a, b) => priority[a.status] - priority[b.status] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : filteredInquiries;
  const open = inquiries.filter((i) => i.status !== 'archived' && i.status !== 'done');
  const closed = inquiries.filter((i) => i.status === 'archived' || i.status === 'done');

  // 어느 경로로 들어온 문의가 많은지 — 광고를 어디에 쓸지 판단하는 근거가 된다.
  const bySource = new Map<string, number>();
  for (const q of inquiries) {
    const key = q.source || 'unknown';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  const sourceStatus = new Map<string, Record<InquiryStatus, number>>();
  for (const inquiry of inquiries) {
    const source = inquiry.source || 'unknown';
    const current = sourceStatus.get(source) ?? { new: 0, contacted: 0, done: 0, archived: 0 };
    current[inquiry.status] += 1;
    sourceStatus.set(source, current);
  }
  const sourceRank = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const conversionRank = [...sourceStatus.entries()]
    .map(([source, counts]) => ({
      source,
      counts,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => (b.counts.done / b.total) - (a.counts.done / a.total));
  const bestSource = conversionRank.find((item) => item.total > 0);
  const campaignMap = new Map<string, { total: number; contacted: number; done: number }>();
  for (const inquiry of inquiries) {
    const key = [inquiry.source, inquiry.medium, inquiry.campaign, inquiry.content].filter(Boolean).join(' / ') || 'unknown';
    const current = campaignMap.get(key) ?? { total: 0, contacted: 0, done: 0 };
    current.total += 1;
    if (inquiry.status === 'contacted' || inquiry.status === 'done') current.contacted += 1;
    if (inquiry.status === 'done') current.done += 1;
    campaignMap.set(key, current);
  }
  const campaignRank = [...campaignMap.entries()].sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));
  const statusCounts = inquiries.reduce(
    (counts, inquiry) => ({ ...counts, [inquiry.status]: (counts[inquiry.status] ?? 0) + 1 }),
    {} as Record<InquiryStatus, number>,
  );
  const contactedCount = (statusCounts.contacted ?? 0) + (statusCounts.done ?? 0);
  const doneCount = statusCounts.done ?? 0;
  const bookedCount = inquiries.filter((inquiry) => memoHas(inquiry.adminMemo, '예약', '완료')).length;
  const paidCount = inquiries.filter((inquiry) => memoHas(inquiry.adminMemo, '결제', '완료')).length;

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
      </header>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>유입·상담 전환 요약</h2>
        <p className={styles.blockHint}>
          {days ? `최근 ${days}일 ` : '전체 기간 '}홈페이지 문의 상태를 기준으로 집계합니다. 문의 클릭이나 결제를 의미하는 수치는 아니며,
          실제 상담·예약 결과는 별도로 기록해야 합니다.
        </p>
        <div className={styles.summary}>
          <Link href="/admin/inquiries" className={`${!days && view === 'all' ? styles.primary : styles.ghost} ${styles.btn} ${styles.sm}`}>전체</Link>
          <Link href={`/admin/inquiries?days=7${view !== 'all' ? `&view=${view}` : ''}`} className={`${days === 7 ? styles.primary : styles.ghost} ${styles.btn} ${styles.sm}`}>최근 7일</Link>
          <Link href={`/admin/inquiries?days=30${view !== 'all' ? `&view=${view}` : ''}`} className={`${days === 30 ? styles.primary : styles.ghost} ${styles.btn} ${styles.sm}`}>최근 30일</Link>
          <Link href={`/admin/inquiries?view=open${days ? `&days=${days}` : ''}`} className={`${view === 'open' ? styles.primary : styles.ghost} ${styles.btn} ${styles.sm}`}>진행 중</Link>
          <Link href={`/admin/inquiries?view=followup${days ? `&days=${days}` : ''}`} className={`${view === 'followup' ? styles.primary : styles.ghost} ${styles.btn} ${styles.sm}`}>후속 기록 있음</Link>
          <Link href={`/admin/inquiries?view=priority${days ? `&days=${days}` : ''}`} className={`${view === 'priority' ? styles.primary : styles.ghost} ${styles.btn} ${styles.sm}`}>오늘 우선 처리</Link>
          <a href={`/admin/inquiries/export${days ? `?days=${days}` : ''}`} className={`${styles.btn} ${styles.ghost} ${styles.sm}`}>CSV 내려받기</a>
        </div>
        <div className={styles.analysisGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>문의</span>
            <strong className={styles.metricValue}>{inquiries.length}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>연락 완료 이상</span>
            <strong className={styles.metricValue}>{contactedCount}</strong>
            <span className={styles.metricRate}>{rate(contactedCount, inquiries.length)}</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>상담 완료</span>
            <strong className={styles.metricValue}>{doneCount}</strong>
            <span className={styles.metricRate}>{rate(doneCount, inquiries.length)}</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>상담률 1위 유입</span>
            <strong className={styles.metricValue}>{bestSource?.source ?? '-'}</strong>
            <span className={styles.metricRate}>{bestSource ? rate(bestSource.counts.done, bestSource.total) : '-'}</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>예약 완료</span>
            <strong className={styles.metricValue}>{bookedCount}</strong>
            <span className={styles.metricRate}>{rate(bookedCount, inquiries.length)}</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>결제 완료</span>
            <strong className={styles.metricValue}>{paidCount}</strong>
            <span className={styles.metricRate}>{rate(paidCount, inquiries.length)}</span>
          </div>
        </div>
        <div className={styles.funnel} aria-label="문의 전환 퍼널">
          <div className={styles.funnelRow}><span>문의</span><b>{inquiries.length}</b><i style={{ width: '100%' }} /></div>
          <div className={styles.funnelRow}><span>연락 완료 이상</span><b>{contactedCount}</b><i style={{ width: `${inquiries.length ? (contactedCount / inquiries.length) * 100 : 0}%` }} /></div>
          <div className={styles.funnelRow}><span>상담 완료</span><b>{doneCount}</b><i style={{ width: `${inquiries.length ? (doneCount / inquiries.length) * 100 : 0}%` }} /></div>
        </div>
        <div className={styles.summary}>
          <span className={styles.summaryItem}>전체 문의 <b>{inquiries.length}</b></span>
          <span className={styles.summaryItem}>신규 <b>{statusCounts.new ?? 0}</b></span>
          <span className={styles.summaryItem}>연락 완료 <b>{statusCounts.contacted ?? 0}</b></span>
          <span className={styles.summaryItem}>상담 완료 <b>{statusCounts.done ?? 0}</b></span>
          <span className={styles.summaryItem}>보관 <b>{statusCounts.archived ?? 0}</b></span>
        </div>
        {campaignRank.length > 0 && (
          <>
            <h3 className={styles.subTitle}>캠페인·콘텐츠별 성과</h3>
            <table className={styles.table}>
              <thead><tr><th>UTM 조합</th><th>문의</th><th>연락 완료 이상</th><th>상담 완료</th><th>상담률</th></tr></thead>
              <tbody>{campaignRank.map(([key, item]) => (
                <tr key={key}><td>{key}</td><td>{item.total}</td><td>{item.contacted}</td><td>{item.done}</td><td>{rate(item.done, item.total)}</td></tr>
              ))}</tbody>
            </table>
          </>
        )}
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Microsoft Clarity 전체 유입 요약</h2>
        <p className={styles.blockHint}>
          {clarityReport.periodLabel}({clarityReport.capturedDate}) 수동 저장 스냅샷입니다. 전체 유입과
          Instagram 유료광고 유입을 같은 기간으로 비교하며, Clarity 행동 데이터는 상담·결제 전환과 별도입니다.
        </p>
        <div className={styles.analysisGrid}>
          <div className={styles.metricCard}><span className={styles.metricLabel}>전체 세션</span><strong className={styles.metricValue}>{clarityReport.overall.sessions}</strong></div>
          <div className={styles.metricCard}><span className={styles.metricLabel}>광고 세션</span><strong className={styles.metricValue}>{clarityReport.paid.sessions}</strong><span className={styles.metricRate}>90.2%</span></div>
          <div className={styles.metricCard}><span className={styles.metricLabel}>전체 평균 스크롤</span><strong className={styles.metricValue}>{clarityReport.overall.scrollDepth}</strong></div>
          <div className={styles.metricCard}><span className={styles.metricLabel}>광고 평균 스크롤</span><strong className={styles.metricValue}>{clarityReport.paid.scrollDepth}</strong></div>
          <div className={styles.metricCard}><span className={styles.metricLabel}>전체 신규 세션</span><strong className={styles.metricValue}>{clarityReport.overall.newSessions}</strong><span className={styles.metricRate}>95.1%</span></div>
          <div className={styles.metricCard}><span className={styles.metricLabel}>전체 데드클릭</span><strong className={styles.metricValue}>{clarityReport.overall.deadClickSessions}</strong><span className={styles.metricRate}>{clarityReport.overall.deadClickRate}</span></div>
        </div>
        <h3 className={styles.subTitle}>유입 소스</h3>
        <table className={styles.table}>
          <thead><tr><th>소스</th><th>세션</th><th>비중</th></tr></thead>
          <tbody>{clarityReport.sources.map((source) => <tr key={source.label}><td>{source.label}</td><td>{source.sessions}</td><td>{rate(source.sessions, clarityReport.overall.sessions)}</td></tr>)}</tbody>
        </table>
        <h3 className={styles.subTitle}>핵심 해석</h3>
        <ul className={styles.auditList}>{clarityReport.findings.map((finding) => <li key={finding} className={styles.auditItem}>{finding}</li>)}</ul>
      </section>

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
          <table className={styles.table}>
            <thead>
              <tr>
                <th>유입 경로</th>
                <th>전체</th>
                <th>신규</th>
                <th>연락 완료</th>
                <th>상담 완료</th>
                <th>연락률</th>
                <th>상담률</th>
              </tr>
            </thead>
            <tbody>
              {conversionRank.map(({ source, total, counts }) => {
                return (
                  <tr key={source}>
                    <td>{source}</td>
                    <td>{total}</td>
                    <td>{counts.new}</td>
                    <td>{counts.contacted}</td>
                    <td>{counts.done}</td>
                    <td>{rate(counts.contacted + counts.done, total)}</td>
                    <td>{rate(counts.done, total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        <span className={styles.srcTag}>추적 {q.trackingRef}</span>
        <span className={styles.srcTag}>{q.source || 'unknown'}</span>
        {q.medium && <span className={styles.srcTag}>{q.medium}</span>}
        {q.campaign && <span className={styles.srcTag}>{q.campaign}</span>}
        {q.content && <span className={styles.srcTag}>{q.content}</span>}
      </div>
      {q.message && <p className={styles.inqMsg}>{q.message}</p>}
      <form action={saveInquiryMemo} className={styles.memoForm}>
        <input type="hidden" name="id" value={q.id} />
        <input className={styles.input} name="memo" defaultValue={q.adminMemo ?? ''} placeholder="예약: 예정 | 결제: 미정 | 다음: 재연락" aria-label="문의 메모" />
        <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">메모 저장</button>
      </form>
      <p className={styles.memoHint}>권장 형식: 예약: 예정/완료/취소 · 결제: 미정/완료 · 다음: 날짜 또는 후속 조치</p>
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
