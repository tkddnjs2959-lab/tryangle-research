import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listMarketingSpend } from '@/lib/marketing-data';
import { importMarketingCsv, logout, removeMarketingSpend, saveMarketingSpendAction } from '../actions';
import AdminTabs from '../AdminTabs';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '광고비 관리 · 관리자', robots: { index: false, follow: false } };

function SpendForm({ row }: { row?: Awaited<ReturnType<typeof listMarketingSpend>>[number] }) {
  return <form action={saveMarketingSpendAction} className={styles.spendForm}>
    {row && <input type="hidden" name="id" value={row.id} />}
    <input className={styles.input} name="spendDate" type="date" defaultValue={row?.spendDate ?? ''} required />
    <input className={styles.input} name="platform" defaultValue={row?.platform ?? 'instagram'} placeholder="플랫폼" required />
    <input className={styles.input} name="accountName" defaultValue={row?.accountName ?? ''} placeholder="광고 계정" />
    <input className={styles.input} name="campaign" defaultValue={row?.campaign ?? ''} placeholder="캠페인" />
    <input className={styles.input} name="spend" type="number" min="0" step="1000" defaultValue={row?.spend ?? ''} placeholder="집행액(원)" required />
    <input className={styles.input} name="impressions" type="number" min="0" defaultValue={row?.impressions ?? ''} placeholder="노출" />
    <input className={styles.input} name="clicks" type="number" min="0" defaultValue={row?.clicks ?? ''} placeholder="클릭" />
    <input className={styles.input} name="note" defaultValue={row?.note ?? ''} placeholder="메모" />
    <button className={`${styles.btn} ${styles.sm}`} type="submit">{row ? '수정 저장' : '추가'}</button>
  </form>;
}

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');
  const params = await searchParams;
  const rows = await listMarketingSpend();
  const total = rows.reduce((sum, row) => sum + row.spend, 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = rows.filter((row) => row.spendDate.startsWith(currentMonth)).reduce((sum, row) => sum + row.spend, 0);
  return <main className={styles.page}>
    <header className={styles.topbar}><div><div className={styles.brand}>TRYANGLE DATA CENTER</div><h1 className={styles.h1}>광고비 관리</h1><div className={styles.meta}>일자별 입력값이 대시보드의 CPL·CPA·ROAS 계산에 사용됩니다.</div></div><form action={logout}><button className={`${styles.btn} ${styles.ghost}`} type="submit">로그아웃</button></form></header>
    <AdminTabs active="marketing" />
    {params.imported && <p className={styles.bannerOk}>CSV {params.imported}건을 저장했습니다. 같은 날짜·플랫폼·캠페인은 최신 값으로 갱신되었습니다.</p>}
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>운영 기준</h2>
      <div className={styles.summary}><span className={styles.summaryItem}>현재 인스타 기준 <b>20,000원/일</b></span><span className={styles.summaryItem}>월 환산 <b>600,000원</b></span><span className={styles.summaryItem}>이번 달 입력 <b>{monthTotal.toLocaleString('ko-KR')}원</b></span><span className={styles.summaryItem}>전체 입력 <b>{total.toLocaleString('ko-KR')}원</b></span></div>
      <p className={styles.blockHint}>지난 기수의 실제 집행일은 광고 관리자 내보내기 자료를 기준으로 입력하세요. 같은 날짜·플랫폼·캠페인은 한 행으로 합쳐집니다.</p>
    </section>
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>인스타그램 유입 운영안</h2>
      <p className={styles.blockHint}>프로필의 첫 번째 링크는 상담 문의로 통일하고, 카카오톡은 빠른 대화가 필요한 방문자를 위한 두 번째 선택으로 둡니다. 링크마다 UTM을 다르게 붙여 성과를 분리합니다.</p>
      <div className={styles.strategyGrid}>
        <div><b>광고 목적지 · 홈페이지</b><code>https://app.tryangle-official.co.kr/go/home?utm_source=instagram&amp;utm_medium=paid_social&amp;utm_campaign=2026_positioning_class&amp;utm_content=single_ad</code></div>
        <div><b>2차 CTA · 카카오톡</b><code>https://app.tryangle-official.co.kr/go/kakao?utm_source=instagram&amp;utm_medium=organic_social&amp;utm_campaign=profile_bio&amp;utm_content=kakao</code></div>
        <div><b>광고 링크</b><span>광고세트별 campaign/content 값을 달리해 소재별 문의·등록을 비교</span></div>
      </div>
    </section>
    <section className={styles.block}><h2 className={styles.blockTitle}>광고비 추가</h2><SpendForm /></section>
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>CSV 일괄 입력</h2>
      <p className={styles.blockHint}>헤더에 <code>date, platform, spend</code>가 반드시 포함되어야 합니다. 선택 항목은 <code>account_name, campaign, impressions, clicks, note</code>입니다. 한 번에 최대 1,000행까지 처리합니다.</p>
      <p className={styles.blockHint}><a href="/marketing-spend-template.csv" download>CSV 입력 템플릿 내려받기</a> · <a href="/api/admin/marketing/export">현재 원장 CSV 내보내기</a> · 예시 행을 지우고 실제 광고 관리자 내보내기 값을 입력하세요.</p>
      <form action={importMarketingCsv} className={styles.csvForm}>
        <input className={styles.input} type="file" name="file" accept=".csv,text/csv" required />
        <button className={`${styles.btn} ${styles.ghost}`} type="submit">CSV 업로드</button>
      </form>
    </section>
    <section className={styles.block}><h2 className={styles.blockTitle}>입력 내역 <em className={styles.countBadge}>{rows.length}</em></h2>{rows.length === 0 ? <p className={styles.empty}>아직 입력된 광고비가 없습니다.</p> : <ul className={styles.spendList}>{rows.map((row) => <li key={row.id}><SpendForm row={row} /><form action={removeMarketingSpend}><input type="hidden" name="id" value={row.id} /><button className={styles.del} type="submit">삭제</button></form></li>)}</ul>}</section>
  </main>;
}
