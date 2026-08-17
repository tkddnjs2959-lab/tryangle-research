import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { getAdminAnalytics, type AnalyticsPeriod, type OperationalAlert, type RankedMetric, type TrendMetric } from '@/lib/admin-analytics';
import { logout } from '../actions';
import AdminTabs from '../AdminTabs';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '통합 분석 대시보드 · 관리자',
  robots: { index: false, follow: false },
};

const formatNumber = new Intl.NumberFormat('ko-KR');

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'alert' | 'good' }) {
  return (
    <article className={`${styles.metricCard} ${tone ? styles[`metricCard_${tone}`] : ''}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.metricNote}>{note}</span>
    </article>
  );
}

function FunnelStage({ label, value, rate, height, tone }: { label: string; value: string; rate: string; height: number; tone?: 'blue' | 'green' | 'orange' }) {
  return (
    <div className={styles.funnelStage}>
      <strong>{value}</strong>
      <span>{label}</span>
      <i className={tone ? styles[`funnelBar_${tone}`] : ''} style={{ height: `${Math.max(height, 12)}px` }} />
      <small>{rate}</small>
    </div>
  );
}

function Ranking({ title, items, emptyText = '분석할 데이터가 아직 없습니다.' }: { title: string; items: RankedMetric[]; emptyText?: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className={styles.insightPanel}>
      <h3 className={styles.insightTitle}>{title}</h3>
      {items.length === 0 ? <p className={styles.insightEmpty}>{emptyText}</p> : (
        <ol className={styles.rankList}>
          {items.map((item) => (
            <li key={item.label}>
              <div className={styles.rankHead}><span>{item.label}</span><b>{item.count}건 · {item.share}%</b></div>
              <div className={styles.rankTrack}><i style={{ width: `${(item.count / max) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function changeRate(current: number, previous: number) {
  if (previous === 0) return current === 0 ? '—' : '신규';
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${change > 0 ? '+' : ''}${change}%`;
}

function TrendChart({ points }: { points: TrendMetric[] }) {
  const max = Math.max(...points.flatMap((point) => [point.inquiries, point.confirmedEnrollments]), 1);
  const chartHeight = 120;
  const chartWidth = 680;
  const left = 34;
  const right = 10;
  const top = 10;
  const bottom = 24;
  const innerWidth = chartWidth - left - right;
  const innerHeight = chartHeight - top - bottom;
  const x = (index: number) => left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => top + innerHeight - (value / max) * innerHeight;
  const inquiryPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.inquiries)}`).join(' ');
  const enrollmentPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.confirmedEnrollments)}`).join(' ');
  const labelIndexes = points.length > 8 ? [0, 3, 6, 9, 13] : points.map((_, index) => index);
  return (
    <div className={styles.trendChartWrap}>
      <svg className={styles.trendChart} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="최근 14일 문의와 확정 등록 추이">
        {[0, 0.5, 1].map((ratio) => <line key={ratio} className={styles.trendGrid} x1={left} x2={chartWidth - right} y1={y(max * ratio)} y2={y(max * ratio)} />)}
        <path className={styles.trendArea} d={`${inquiryPath} L ${x(points.length - 1)} ${top + innerHeight} L ${x(0)} ${top + innerHeight} Z`} />
        <path className={styles.trendLine} d={inquiryPath} />
        <path className={styles.trendLineSecondary} d={enrollmentPath} />
        {points.map((point, index) => <circle key={point.date} className={styles.trendDot} cx={x(index)} cy={y(point.inquiries)} r="2.5"><title>{`${point.label} 문의 ${point.inquiries}건`}</title></circle>)}
        {labelIndexes.map((index) => <text key={points[index].date} className={styles.trendLabel} x={x(index)} y={chartHeight - 5} textAnchor="middle">{points[index].label}</text>)}
      </svg>
      <div className={styles.trendLegend}><span><i className={styles.trendLegendInquiry} />문의</span><span><i className={styles.trendLegendEnrollment} />확정 등록</span></div>
    </div>
  );
}

function AlertList({ alerts }: { alerts: OperationalAlert[] }) {
  const hrefFor = (key: string) => key === 'pending-analyses' || key === 'open-actions' ? '/admin/consultations' : key === 'conversion-drop' ? '/admin/analytics?period=7' : '/admin/inquiries';
  if (alerts.length === 0) return <p className={styles.alertEmpty}>현재 즉시 처리할 운영 알림이 없습니다.</p>;
  return (
    <div className={styles.alertList} aria-label="운영 알림 목록">
      {alerts.slice(0, 5).map((alert) => (
        <div key={alert.key} className={`${styles.alertItem} ${styles[`alertItem_${alert.severity}`]}`}>
          <div><strong>{alert.title}</strong><span>{alert.detail}</span></div>
          <a href={hrefFor(alert.key)}>확인 →</a>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ period?: string; channel?: string; campaign?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');
  const params = await searchParams;
  const period: AnalyticsPeriod = params?.period === '7' || params?.period === 'month' ? params.period : '30';
  const data = await getAdminAnalytics({ period, channel: params?.channel, campaign: params?.campaign });
  const { kpis } = data;
  const view = data.selected;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.brand}>TRYANGLE DATA CENTER</div>
          <h1 className={styles.h1}>통합 분석 대시보드</h1>
          <div className={styles.meta}>상담·수강생·AI 분석·마케팅 유입을 한 화면에서 확인합니다. · {new Date(data.generatedAt).toLocaleString('ko-KR')} 기준</div>
        </div>
        <form action={logout}><button className={`${styles.btn} ${styles.ghost}`} type="submit">로그아웃</button></form>
      </header>

      <AdminTabs active="analytics" />

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}>
          <div><h2>오늘 먼저 볼 지표</h2><p>후속 조치가 필요한 항목과 현재 전환 흐름을 우선 배치했습니다.</p></div>
          <form className={styles.analyticsFilters} method="get">
            <label><span>기간</span><select name="period" defaultValue={data.filters.period}><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="month">이번 달</option></select></label>
            <label><span>채널</span><select name="channel" defaultValue={data.filters.channel}><option value="">전체 채널</option>{data.filters.channels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label>
            <label><span>캠페인</span><select name="campaign" defaultValue={data.filters.campaign}><option value="">전체 캠페인</option>{data.filters.campaigns.map((campaign) => <option key={campaign} value={campaign}>{campaign}</option>)}</select></label>
            <button className={`${styles.btn} ${styles.sm}`} type="submit">적용</button>
          </form>
        </div>
        <div className={styles.priorityStrip}>
          <div><strong>운영 알림 {data.alerts.length}건</strong><span>선택 기간: {data.filters.period === '7' ? '최근 7일' : data.filters.period === 'month' ? '이번 달' : '최근 30일'} · 우선순위가 높은 항목부터 표시합니다.</span></div>
          <a href="#operational-alerts">알림 보기 ↓</a>
        </div>
        <div id="operational-alerts"><AlertList alerts={data.alerts} /></div>
        <div className={styles.primaryMetricGrid}>
          <MetricCard label="선택 기간 문의" value={`${formatNumber.format(view.inquiries)}건`} note={`전체 신규 응대 ${kpis.newInquiries}건`} tone={kpis.newInquiries > 0 ? 'alert' : undefined} />
          <MetricCard label="문의→상담 연결률" value={`${view.consultationRate}%`} note="선택 기간 기준" tone={view.consultationRate >= 50 ? 'good' : undefined} />
          <MetricCard label="확정 등록" value={`${view.confirmedEnrollments}명`} note={`선택 기간 · 전체 ${kpis.confirmedEnrollments}명`} tone={view.confirmedEnrollments > 0 ? 'good' : undefined} />
          <MetricCard label="결제 매출" value={`${formatNumber.format(view.paidRevenue)}원`} note={`ROAS ${view.roas === null ? '—' : `${view.roas}배`} · 선택 기간`} />
        </div>
        <div className={styles.secondaryMetricGrid}>
          <MetricCard label="상담 진행" value={`${formatNumber.format(view.consultations)}건`} note="선택 기간 기준" />
          <MetricCard label="AI 분석 커버리지" value={`${kpis.analysisCoverage}%`} note={`${kpis.analyses}/${kpis.consultations}개 상담`} />
          <MetricCard label="승인 대기 분석" value={`${kpis.pendingAnalyses}건`} note="관리자 검토 필요" tone={kpis.pendingAnalyses > 0 ? 'alert' : undefined} />
          <MetricCard label="전환 가능성 높음" value={`${kpis.highIntent}건`} note="AI 분석의 high 신호" tone={kpis.highIntent > 0 ? 'good' : undefined} />
          <MetricCard label="선택 기간 광고비" value={`${formatNumber.format(view.adSpend)}원`} note="입력된 실제 집행액" />
          <MetricCard label="선택 기간 CPL" value={view.cpl === null ? '—' : `${formatNumber.format(view.cpl)}원`} note={`문의 ${view.inquiries}건 기준`} />
          <MetricCard label="홈페이지 클릭" value={`${formatNumber.format(view.homepageClicks)}회`} note="선택 기간 추적 링크" />
          <MetricCard label="카카오톡 클릭" value={`${formatNumber.format(view.kakaoClicks)}회`} note="선택 기간 추적 링크" />
        </div>
      </section>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}><div><h2>고객 전환 퍼널</h2><p>홈페이지 클릭부터 결제까지의 단계별 규모와 전환율입니다.</p></div></div>
        <div className={styles.funnelVisual}>
          <FunnelStage label="홈페이지 클릭" value={`${formatNumber.format(view.homepageClicks)}회`} rate="선택 기간 유입" height={72} tone="blue" />
          <FunnelStage label="상담 문의" value={`${formatNumber.format(view.inquiries)}건`} rate={view.homepageClicks > 0 ? `${Math.round((view.inquiries / view.homepageClicks) * 1000) / 10}%` : '—'} height={58} tone="blue" />
          <FunnelStage label="상담 진행" value={`${formatNumber.format(view.consultations)}건`} rate={`${view.consultationRate}%`} height={45} tone="green" />
          <FunnelStage label="확정 등록" value={`${formatNumber.format(view.confirmedEnrollments)}명`} rate={view.consultations > 0 ? `${Math.round((view.confirmedEnrollments / view.consultations) * 1000) / 10}%` : '—'} height={32} tone="green" />
          <FunnelStage label="결제 완료" value={`${formatNumber.format(view.paidRevenue)}원`} rate={view.confirmedEnrollments > 0 ? '등록 후 매출' : '—'} height={24} tone="orange" />
        </div>
      </section>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}><div><h2>기간 비교</h2><p>최근 7일·30일을 직전 동일 기간과 비교합니다. 광고비와 매출은 입력된 데이터 기준입니다.</p></div></div>
        <div className={styles.tableWrap}>
          <table className={styles.metricTable}>
            <thead><tr><th>지표</th><th>최근 7일</th><th>직전 7일</th><th>변화</th><th>최근 30일</th><th>직전 30일</th><th>변화</th></tr></thead>
            <tbody>
              {([
                ['광고비', 'adSpend'],
                ['홈페이지 클릭', 'homepageClicks'],
                ['카카오 클릭', 'kakaoClicks'],
                ['문의', 'inquiries'],
                ['확정 등록', 'confirmedEnrollments'],
                ['결제 매출', 'paidRevenue'],
              ] as const).map(([label, key]) => {
                const p7 = data.periods.previous7[key];
                const l7 = data.periods.last7[key];
                const p30 = data.periods.previous30[key];
                const l30 = data.periods.last30[key];
                const money = key === 'adSpend' || key === 'paidRevenue';
                const format = (value: number) => money ? `${formatNumber.format(value)}원` : formatNumber.format(value);
                return <tr key={key}><th>{label}</th><td>{format(l7)}</td><td>{format(p7)}</td><td><b>{changeRate(l7, p7)}</b></td><td>{format(l30)}</td><td>{format(p30)}</td><td><b>{changeRate(l30, p30)}</b></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}><div><h2>문의·등록 추이</h2><p>최근 14일의 일별 문의와 확정 등록을 비교합니다.</p></div><span className={styles.sectionHint}>데이터가 쌓일수록 추세가 선명해집니다.</span></div>
        <TrendChart points={data.trend} />
      </section>

      <div className={styles.dashboardColumns}>
        <section className={styles.dashboardSection}>
          <div className={styles.sectionHead}><div><h2>마케팅 유입 성과</h2><p>과거 `ig/social`과 신규 `instagram/paid_social`을 표준 채널로 통합해 비교합니다.</p></div></div>
          {data.marketing.length === 0 ? <p className={styles.insightEmpty}>아직 유입 데이터가 없습니다.</p> : (
            <div className={styles.tableWrap}>
              <table className={styles.metricTable}>
                <thead><tr><th>채널</th><th>문의</th><th>상담</th><th>등록</th><th>매출</th><th>상담률</th></tr></thead>
                <tbody>{data.marketing.map((row) => (
                  <tr key={row.channel}><th>{row.channel}</th><td>{row.inquiries}</td><td>{row.consultations}</td><td>{row.enrollments}</td><td>{formatNumber.format(row.revenue)}원</td><td><b>{row.consultationRate}%</b></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Ranking title="캠페인별 문의" items={data.campaigns} emptyText="campaign UTM 값이 수집되면 순위가 표시됩니다." />
          <div className={styles.insightPanel}>
            <h3 className={styles.insightTitle}>홈페이지 유입 클릭</h3>
            {data.inboundClicks.length === 0 ? <p className={styles.insightEmpty}>홈페이지 추적 클릭이 쌓이면 채널·캠페인별 집계가 표시됩니다.</p> : (
              <div className={styles.tableWrap}>
                <table className={styles.metricTable}>
                  <thead><tr><th>채널</th><th>캠페인</th><th>클릭</th><th>비중</th></tr></thead>
                  <tbody>{data.inboundClicks.map((item) => (
                    <tr key={`${item.channel}-${item.campaign}`}><th>{item.channel}</th><td>{item.campaign}</td><td>{item.clicks}회</td><td>{item.share}%</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
          <div className={styles.insightPanel}>
            <h3 className={styles.insightTitle}>카카오 CTA 위치별 클릭</h3>
            {data.ctaPlacements.length === 0 ? <p className={styles.insightEmpty}>카카오 추적 클릭이 쌓이면 위치별 성과가 표시됩니다.</p> : (
              <ol className={styles.rankList}>
                {data.ctaPlacements.map((item) => <li key={item.placement}><div className={styles.rankHead}><span>{item.placement}</span><b>{item.clicks}회 · {item.share}%</b></div></li>)}
              </ol>
            )}
          </div>
        </section>

        <section className={styles.dashboardSection}>
          <div className={styles.sectionHead}><div><h2>상담 AI 핵심 신호</h2><p>상담 분석이 쌓일수록 반복 요구와 이탈 요인이 선명해집니다.</p></div></div>
          <div className={styles.insightGrid}>
            <Ranking title="전환 가능성" items={data.conversionSignals} />
            <Ranking title="주요 니즈" items={data.needs} />
            <Ranking title="고민·장벽" items={data.painPoints} />
            <Ranking title="추천 프로그램" items={data.recommendedPrograms} />
            <Ranking title="위험 신호" items={data.riskFlags} />
          </div>
        </section>
      </div>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}>
          <div><h2>과거 데이터 참고 퍼널</h2><p>이전 상담자료에서 상담 명단과 수강생 명단을 단순 비교한 참고치입니다. 동일인 매칭 전에는 확정 전환율로 사용하지 않습니다.</p></div>
          <span className={styles.referenceBadge}>검증 전 참고값</span>
        </div>
        <div className={styles.funnelSummary}>
          <div><span>과거 상담</span><strong>{data.legacy.consultations}명</strong></div>
          <span className={styles.funnelArrow}>→</span>
          <div><span>수강생 목록</span><strong>{data.legacy.studentProfiles}명</strong></div>
          <span className={styles.funnelArrow}>→</span>
          <div><span>겉보기 전환</span><strong>{data.legacy.referenceConversionRate}%</strong></div>
          <small>미매칭 {data.legacy.unmatched}건</small>
        </div>
        {data.cohorts.length > 0 && (
          <div className={styles.tableWrap}><table className={styles.metricTable}>
            <thead><tr><th>기수</th><th>상담 목록</th><th>수강생 목록</th><th>참고 비율</th></tr></thead>
            <tbody>{data.cohorts.map((row) => <tr key={row.cohort}><th>{row.cohort}</th><td>{row.consultations}</td><td>{row.studentProfiles}</td><td>{row.referenceConversionRate}%</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <section className={`${styles.dashboardSection} ${styles.integrationSection}`}>
        <div className={styles.sectionHead}><div><h2>종합 마케팅 분석 연동 순서</h2><p>문의·상담·등록·결제까지 연결됐습니다. 광고비 데이터를 붙이면 비용과 수익성까지 같은 화면에서 볼 수 있습니다.</p></div><a className={styles.back} href="/admin/funnel">등록·결제 관리 →</a></div>
        <ol className={styles.integrationSteps}>
          <li><b>1. 유입 표준화</b><span>모든 문의에 source / medium / campaign / content 자동 저장</span></li>
          <li><b>2. 광고비 연결</b><span>Meta·Google·Kakao 캠페인별 일 지출, 노출, 클릭 수집</span></li>
          <li><b>3. 등록·결제 연결</b><span>문의 ID를 상담, 수강 등록, 결제금액까지 이어서 실제 전환 확정</span></li>
          <li><b>4. 광고비 연동</b><span>Meta·Google·Kakao 캠페인별 비용을 추가하면 CPL, CPA, ROAS 자동 계산</span></li>
        </ol>
        <p className={styles.dataRule}>핵심 원칙: Supabase를 기준 데이터베이스로 두고, Google Drive는 원본 파일 보관·백업 용도로 분리합니다.</p>
      </section>
    </main>
  );
}
