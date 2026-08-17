import 'server-only';
import { db } from './supabase';

type UnknownRecord = Record<string, unknown>;

export type RankedMetric = {
  label: string;
  count: number;
  share: number;
};

export type MarketingMetric = {
  channel: string;
  inquiries: number;
  consultations: number;
  enrollments: number;
  revenue: number;
  consultationRate: number;
  enrollmentRate: number;
};

export type CohortMetric = {
  cohort: string;
  consultations: number;
  studentProfiles: number;
  referenceConversionRate: number;
};

export type PeriodSnapshot = {
  adSpend: number;
  homepageClicks: number;
  kakaoClicks: number;
  inquiries: number;
  consultations: number;
  confirmedEnrollments: number;
  paidRevenue: number;
};

export type OperationalAlert = {
  key: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
  count?: number;
};

export type CtaMetric = {
  placement: string;
  clicks: number;
  share: number;
};

export type InboundClickMetric = {
  channel: string;
  campaign: string;
  clicks: number;
  share: number;
};

export type TrendMetric = {
  date: string;
  label: string;
  inquiries: number;
  confirmedEnrollments: number;
};

export type AnalyticsPeriod = '7' | '30' | 'month';

export type AnalyticsFilters = {
  period?: AnalyticsPeriod;
  channel?: string;
  campaign?: string;
};

export type AdminAnalytics = {
  generatedAt: string;
  kpis: {
    inquiries: number;
    newInquiries: number;
    consultations: number;
    consultedInquiries: number;
    consultationRate: number;
    analyses: number;
    analysisCoverage: number;
    pendingAnalyses: number;
    highIntent: number;
    activeStudents: number;
    openActions: number;
    enrollments: number;
    confirmedEnrollments: number;
    paidRevenue: number;
    adSpendCurrentMonth: number;
    adSpendAllTime: number;
    inquiriesCurrentMonth: number;
    confirmedEnrollmentsCurrentMonth: number;
    paidRevenueCurrentMonth: number;
    cplCurrentMonth: number | null;
    cpaCurrentMonth: number | null;
    roasCurrentMonth: number | null;
    cpl: number | null;
    cpa: number | null;
    roas: number | null;
    homepageClicks: number;
    kakaoClicks: number;
  };
  marketing: MarketingMetric[];
  campaigns: RankedMetric[];
  conversionSignals: RankedMetric[];
  needs: RankedMetric[];
  painPoints: RankedMetric[];
  recommendedPrograms: RankedMetric[];
  riskFlags: RankedMetric[];
  cohorts: CohortMetric[];
  periods: {
    last7: PeriodSnapshot;
    previous7: PeriodSnapshot;
    last30: PeriodSnapshot;
    previous30: PeriodSnapshot;
  };
  inboundClicks: InboundClickMetric[];
  ctaPlacements: CtaMetric[];
  trend: TrendMetric[];
  filters: { period: AnalyticsPeriod; channel: string; campaign: string; channels: string[]; campaigns: string[] };
  selected: {
    inquiries: number;
    consultations: number;
    consultationRate: number;
    confirmedEnrollments: number;
    paidRevenue: number;
    adSpend: number;
    homepageClicks: number;
    kakaoClicks: number;
    cpl: number | null;
    cpa: number | null;
    roas: number | null;
  };
  alerts: OperationalAlert[];
  legacy: {
    consultations: number;
    studentProfiles: number;
    referenceConversionRate: number;
    unmatched: number;
  };
};

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function meaningful(value: unknown, fallback = '미분류') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.toLowerCase() !== 'unknown' ? text : fallback;
}

function normalizedChannel(source: unknown, medium: unknown) {
  const sourceValue = typeof source === 'string' ? source.trim().toLowerCase() : '';
  const mediumValue = typeof medium === 'string' ? medium.trim().toLowerCase() : '';

  if (sourceValue === 'ig' || sourceValue === 'instagram' || sourceValue === 'l.instagram.com') {
    if (['paid_social', 'paid-social', 'cpc', 'paid'].includes(mediumValue)) return 'Instagram 유료광고';
    if (['social', 'organic_social', 'organic-social', 'link_in_bio'].includes(mediumValue)) return 'Instagram 자연유입';
    return 'Instagram';
  }
  return meaningful(medium, meaningful(source));
}

function isInternalTest(row: { source?: unknown; medium?: unknown; campaign?: unknown; content?: unknown }) {
  return [row.source, row.medium, row.campaign, row.content]
    .some((value) => typeof value === 'string' && value.trim().toLowerCase().startsWith('internal_test'));
}

function isMalformedAttribution(row: { source?: unknown; medium?: unknown; campaign?: unknown; content?: unknown }) {
  return [row.source, row.medium, row.campaign, row.content]
    .some((value) => typeof value === 'string' && value.includes('u0026'));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const record = item as UnknownRecord;
        return meaningful(record.label ?? record.title ?? record.name, '');
      }
      return '';
    })
    .filter(Boolean);
}

function rank(values: string[], limit = 6): RankedMetric[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const total = values.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, share: percentage(count, total) }));
}

export async function getAdminAnalytics(filters: AnalyticsFilters = {}): Promise<AdminAnalytics> {
  const client = db();
  const [actorsResult, inquiriesResult, sessionsResult, analysesResult, actionsResult, enrollmentsResult, paymentsResult, spendResult, legacyResult, linkClicksResult] =
    await Promise.all([
      client.from('actors').select('id, status'),
      client.from('inquiries').select('id, source, medium, campaign, status, created_at'),
      client.from('consultation_sessions').select('id, inquiry_id, status, consulted_at'),
      client
        .from('consultation_analyses')
        .select('id, session_id, status, structured_result, created_at')
        .order('created_at', { ascending: false }),
      client.from('consultation_action_items').select('id, status'),
      client.from('enrollments').select('id, inquiry_id, source, medium, campaign, status, created_at'),
      client.from('payments').select('enrollment_id, amount, status, paid_at, created_at'),
      client.from('marketing_spend_daily').select('spend_date, spend'),
      client
        .from('legacy_import_rows')
        .select('record_kind, cohort_label, match_status'),
      client.from('marketing_link_clicks').select('destination, source, medium, campaign, content, created_at'),
    ]);

  const failures = [actorsResult, inquiriesResult, sessionsResult, analysesResult, actionsResult, enrollmentsResult, paymentsResult, spendResult, legacyResult, linkClicksResult]
    .map((result) => result.error?.message)
    .filter(Boolean);
  if (failures.length) throw new Error(`대시보드 데이터를 불러오지 못했습니다: ${failures.join(' / ')}`);

  const actors = actorsResult.data ?? [];
  const inquiries = inquiriesResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const analyses = analysesResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const enrollments = enrollmentsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const spendRows = spendResult.data ?? [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const adSpendCurrentMonth = spendRows.filter((row) => String(row.spend_date).startsWith(currentMonth)).reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
  const adSpendAllTime = spendRows.reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
  const inquiriesCurrentMonth = inquiries.filter((row) => String(row.created_at).startsWith(currentMonth)).length;
  const confirmedEnrollmentsCurrentMonth = enrollments.filter((row) =>
    String(row.created_at).startsWith(currentMonth) && (row.status === 'enrolled' || row.status === 'completed')
  ).length;
  const legacyRows = (legacyResult.data ?? []).filter((row) => row.match_status !== 'rejected');
  const operationalLinkClicks = (linkClicksResult.data ?? []).filter((row) => !isInternalTest(row) && !isMalformedAttribution(row));

  const dateKey = (value: Date) => value.toISOString().slice(0, 10);
  const trendStart = new Date(Date.now() - 13 * 86400000);
  trendStart.setUTCHours(0, 0, 0, 0);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(trendStart.getTime() + index * 86400000);
    const key = dateKey(date);
    const inquiryCount = inquiries.filter((row) => String(row.created_at).slice(0, 10) === key).length;
    const enrollmentCount = enrollments.filter((row) =>
      String(row.created_at).slice(0, 10) === key && (row.status === 'enrolled' || row.status === 'completed')
    ).length;
    return {
      date: key,
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      inquiries: inquiryCount,
      confirmedEnrollments: enrollmentCount,
    };
  });

  const selectedPeriod: AnalyticsPeriod = filters.period === '7' || filters.period === 'month' ? filters.period : '30';
  const selectedChannel = filters.channel?.trim() ?? '';
  const selectedCampaign = filters.campaign?.trim() ?? '';
  const selectedEnd = Date.now();
  const selectedStart = selectedPeriod === 'month'
    ? new Date(`${currentMonth}-01T00:00:00.000Z`).getTime()
    : selectedEnd - Number(selectedPeriod) * 86400000;
  const inSelectedRange = (value: unknown) => {
    const time = new Date(String(value ?? '')).getTime();
    return Number.isFinite(time) && time >= selectedStart && time <= selectedEnd;
  };
  const matchesSelectedAttribution = (row: { source?: unknown; medium?: unknown; campaign?: unknown }) => {
    const channel = normalizedChannel(row.source, row.medium);
    const campaign = meaningful(row.campaign, '캠페인 미상');
    return (!selectedChannel || channel === selectedChannel) && (!selectedCampaign || campaign === selectedCampaign);
  };
  const selectedInquiries = inquiries.filter((row) => inSelectedRange(row.created_at) && matchesSelectedAttribution(row));
  const selectedInquiryIds = new Set(selectedInquiries.map((row) => row.id as string));
  const selectedSessions = sessions.filter((row) => selectedInquiryIds.has(row.inquiry_id as string) || (!selectedChannel && !selectedCampaign && inSelectedRange(row.consulted_at)));
  const selectedEnrollments = enrollments.filter((row) => inSelectedRange(row.created_at) && matchesSelectedAttribution(row));
  const selectedEnrollmentIds = new Set(selectedEnrollments.map((row) => row.id as string));
  const selectedPayments = payments.filter((row) => selectedEnrollmentIds.has(row.enrollment_id as string) && inSelectedRange(row.paid_at ?? row.created_at));
  const selectedRevenue = selectedPayments.reduce((sum, payment) => {
    const amount = Number(payment.amount ?? 0);
    return sum + (payment.status === 'paid' ? amount : payment.status === 'refunded' ? -amount : 0);
  }, 0);
  const selectedSpend = spendRows.filter((row) => inSelectedRange(`${row.spend_date}T00:00:00.000Z`)).reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
  const selectedClicks = operationalLinkClicks.filter((row) => inSelectedRange(row.created_at) && matchesSelectedAttribution(row));
  const selectedConfirmedEnrollments = selectedEnrollments.filter((row) => row.status === 'enrolled' || row.status === 'completed').length;
  const selectedConsultations = selectedSessions.length;
  const selectedConsultationRate = percentage(selectedConsultations, selectedInquiries.length);
  const selectedCpl = selectedSpend > 0 && selectedInquiries.length > 0 ? Math.round(selectedSpend / selectedInquiries.length) : null;
  const selectedCpa = selectedSpend > 0 && selectedConfirmedEnrollments > 0 ? Math.round(selectedSpend / selectedConfirmedEnrollments) : null;
  const selectedRoas = selectedSpend > 0 ? Math.round((selectedRevenue / selectedSpend) * 100) / 100 : null;
  const selectedPaidByEnrollment = new Map<string, number>();
  for (const payment of selectedPayments) {
    const amount = Number(payment.amount ?? 0);
    const id = payment.enrollment_id as string;
    selectedPaidByEnrollment.set(id, (selectedPaidByEnrollment.get(id) ?? 0) + (payment.status === 'paid' ? amount : payment.status === 'refunded' ? -amount : 0));
  }
  const selectedMarketingGroups = new Map<string, { inquiries: string[]; consulted: Set<string>; enrollments: number; revenue: number }>();
  for (const inquiry of selectedInquiries) {
    const channel = normalizedChannel(inquiry.source, inquiry.medium);
    const group = selectedMarketingGroups.get(channel) ?? { inquiries: [], consulted: new Set<string>(), enrollments: 0, revenue: 0 };
    const id = inquiry.id as string;
    group.inquiries.push(id);
    if (selectedSessions.some((session) => session.inquiry_id === id)) group.consulted.add(id);
    selectedMarketingGroups.set(channel, group);
  }
  for (const enrollment of selectedEnrollments) {
    const channel = normalizedChannel(enrollment.source, enrollment.medium);
    const group = selectedMarketingGroups.get(channel) ?? { inquiries: [], consulted: new Set<string>(), enrollments: 0, revenue: 0 };
    if (enrollment.status === 'enrolled' || enrollment.status === 'completed') group.enrollments += 1;
    group.revenue += selectedPaidByEnrollment.get(enrollment.id as string) ?? 0;
    selectedMarketingGroups.set(channel, group);
  }
  const selectedMarketing = [...selectedMarketingGroups.entries()]
    .map(([channel, group]) => ({
      channel,
      inquiries: group.inquiries.length,
      consultations: group.consulted.size,
      enrollments: group.enrollments,
      revenue: group.revenue,
      consultationRate: percentage(group.consulted.size, group.inquiries.length),
      enrollmentRate: percentage(group.enrollments, group.inquiries.length),
    }))
    .sort((a, b) => b.inquiries - a.inquiries || a.channel.localeCompare(b.channel, 'ko'));
  const selectedHomepageLinks = selectedClicks.filter((row) => row.destination === 'homepage');
  const selectedInboundCounts = new Map<string, { channel: string; campaign: string; clicks: number }>();
  for (const link of selectedHomepageLinks) {
    const channel = normalizedChannel(link.source, link.medium);
    const campaign = meaningful(link.campaign, '캠페인 미상');
    const key = `${channel}\u0000${campaign}`;
    const current = selectedInboundCounts.get(key) ?? { channel, campaign, clicks: 0 };
    current.clicks += 1;
    selectedInboundCounts.set(key, current);
  }
  const selectedInboundClicks = [...selectedInboundCounts.values()]
    .sort((a, b) => b.clicks - a.clicks || a.channel.localeCompare(b.channel, 'ko'))
    .map((row) => ({ ...row, share: percentage(row.clicks, selectedHomepageLinks.length) }));
  const selectedKakaoLinks = selectedClicks.filter((row) => row.destination === 'kakao');
  const selectedCtaCounts = new Map<string, number>();
  for (const link of selectedKakaoLinks) {
    const placement = meaningful(link.content, '미분류 CTA');
    selectedCtaCounts.set(placement, (selectedCtaCounts.get(placement) ?? 0) + 1);
  }
  const selectedCtaPlacements = [...selectedCtaCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .map(([placement, clicks]) => ({ placement, clicks, share: percentage(clicks, selectedKakaoLinks.length) }));
  const availableChannels = [...new Set(inquiries.map((row) => normalizedChannel(row.source, row.medium)))].sort((a, b) => a.localeCompare(b, 'ko'));
  const availableCampaigns = [...new Set(inquiries.map((row) => meaningful(row.campaign, '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  const snapshot = (daysAgo: number, length: number): PeriodSnapshot => {
    const end = Date.now() - daysAgo * 86400000;
    const start = end - length * 86400000;
    const inRange = (value: unknown) => {
      const time = new Date(String(value ?? '')).getTime();
      return Number.isFinite(time) && time >= start && time < end;
    };
    const spend = spendRows
      .filter((row) => inRange(`${row.spend_date}T00:00:00.000Z`))
      .reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
    const links = operationalLinkClicks;
    const revenue = payments.reduce((sum, payment) => {
      if (!inRange(payment.paid_at ?? payment.created_at)) return sum;
      const amount = Number(payment.amount ?? 0);
      return sum + (payment.status === 'paid' ? amount : payment.status === 'refunded' ? -amount : 0);
    }, 0);
    return {
      adSpend: spend,
      homepageClicks: links.filter((row) => row.destination === 'homepage' && inRange(row.created_at)).length,
      kakaoClicks: links.filter((row) => row.destination === 'kakao' && inRange(row.created_at)).length,
      inquiries: inquiries.filter((row) => inRange(row.created_at)).length,
      consultations: sessions.filter((row) => inRange(row.consulted_at)).length,
      confirmedEnrollments: enrollments.filter((row) => inRange(row.created_at) && (row.status === 'enrolled' || row.status === 'completed')).length,
      paidRevenue: revenue,
    };
  };

  const latestAnalysisBySession = new Map<string, (typeof analyses)[number]>();
  for (const analysis of analyses) {
    if (!latestAnalysisBySession.has(analysis.session_id as string)) {
      latestAnalysisBySession.set(analysis.session_id as string, analysis);
    }
  }
  const currentAnalyses = [...latestAnalysisBySession.values()];

  const consultedInquiryIds = new Set(
    sessions.map((row) => row.inquiry_id as string | null).filter((id): id is string => Boolean(id))
  );

  const paidByEnrollment = new Map<string, number>();
  let paidRevenueCurrentMonth = 0;
  for (const payment of payments) {
    const id = payment.enrollment_id as string;
    const amount = Number(payment.amount ?? 0);
    if (payment.status === 'paid') paidByEnrollment.set(id, (paidByEnrollment.get(id) ?? 0) + amount);
    if (payment.status === 'refunded') paidByEnrollment.set(id, (paidByEnrollment.get(id) ?? 0) - amount);
    const paymentDate = String(payment.paid_at ?? payment.created_at);
    if (paymentDate.startsWith(currentMonth)) {
      if (payment.status === 'paid') paidRevenueCurrentMonth += amount;
      if (payment.status === 'refunded') paidRevenueCurrentMonth -= amount;
    }
  }
  const marketingGroups = new Map<string, { inquiries: string[]; consulted: Set<string>; enrollments: number; revenue: number }>();
  for (const inquiry of inquiries) {
    const channel = normalizedChannel(inquiry.source, inquiry.medium);
    const group = marketingGroups.get(channel) ?? { inquiries: [], consulted: new Set<string>(), enrollments: 0, revenue: 0 };
    const id = inquiry.id as string;
    group.inquiries.push(id);
    if (consultedInquiryIds.has(id)) group.consulted.add(id);
    marketingGroups.set(channel, group);
  }
  for (const enrollment of enrollments) {
    const channel = normalizedChannel(enrollment.source, enrollment.medium);
    const group = marketingGroups.get(channel) ?? { inquiries: [], consulted: new Set<string>(), enrollments: 0, revenue: 0 };
    if (enrollment.status === 'enrolled' || enrollment.status === 'completed') group.enrollments += 1;
    group.revenue += paidByEnrollment.get(enrollment.id as string) ?? 0;
    marketingGroups.set(channel, group);
  }
  const marketing = [...marketingGroups.entries()]
    .map(([channel, group]) => ({
      channel,
      inquiries: group.inquiries.length,
      consultations: group.consulted.size,
      enrollments: group.enrollments,
      revenue: group.revenue,
      consultationRate: percentage(group.consulted.size, group.inquiries.length),
      enrollmentRate: percentage(group.enrollments, group.inquiries.length),
    }))
    .sort((a, b) => b.inquiries - a.inquiries || a.channel.localeCompare(b.channel, 'ko'));

  const kakaoLinks = operationalLinkClicks.filter((row) => row.destination === 'kakao');
  const ctaCounts = new Map<string, number>();
  for (const link of kakaoLinks) {
    const placement = meaningful(link.content, '미분류 CTA');
    ctaCounts.set(placement, (ctaCounts.get(placement) ?? 0) + 1);
  }
  const ctaPlacements = [...ctaCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .map(([placement, clicks]) => ({ placement, clicks, share: percentage(clicks, kakaoLinks.length) }));

  const inboundLinkCounts = new Map<string, { channel: string; campaign: string; clicks: number }>();
  const homepageLinks = operationalLinkClicks.filter((row) => row.destination === 'homepage');
  for (const link of homepageLinks) {
    const channel = normalizedChannel(link.source, link.medium);
    const campaign = meaningful(link.campaign, '캠페인 미상');
    const key = `${channel}\u0000${campaign}`;
    const current = inboundLinkCounts.get(key) ?? { channel, campaign, clicks: 0 };
    current.clicks += 1;
    inboundLinkCounts.set(key, current);
  }
  const inboundClicks = [...inboundLinkCounts.values()]
    .sort((a, b) => b.clicks - a.clicks || a.channel.localeCompare(b.channel, 'ko'))
    .map((row) => ({ ...row, share: percentage(row.clicks, homepageLinks.length) }));

  const structuredResults = currentAnalyses.map((row) => {
    const result = row.structured_result;
    return result && typeof result === 'object' ? (result as UnknownRecord) : {};
  });
  const signals = structuredResults.map((result) => meaningful(result.conversion_signal, 'unknown'));
  const signalLabels: Record<string, string> = {
    high: '높음',
    medium: '보통',
    low: '낮음',
    unknown: '판단 보류',
  };

  const legacyByCohort = new Map<string, { consultations: number; studentProfiles: number }>();
  for (const row of legacyRows) {
    const cohort = meaningful(row.cohort_label, '기수 미상');
    const group = legacyByCohort.get(cohort) ?? { consultations: 0, studentProfiles: 0 };
    if (row.record_kind === 'consultation') group.consultations += 1;
    if (row.record_kind === 'student_profile') group.studentProfiles += 1;
    legacyByCohort.set(cohort, group);
  }
  const cohorts = [...legacyByCohort.entries()]
    .map(([cohort, group]) => ({
      cohort,
      ...group,
      referenceConversionRate: percentage(group.studentProfiles, group.consultations),
    }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort, 'ko', { numeric: true }));
  const legacyConsultations = cohorts.reduce((sum, item) => sum + item.consultations, 0);
  const legacyStudentProfiles = cohorts.reduce((sum, item) => sum + item.studentProfiles, 0);
  const last7 = snapshot(0, 7);
  const previous7 = snapshot(7, 7);
  const last7ConsultationRate = percentage(last7.consultations, last7.inquiries);
  const previous7ConsultationRate = percentage(previous7.consultations, previous7.inquiries);
  const unclassifiedInquiries = inquiries.filter((row) => !row.source && !row.medium && !row.campaign).length;
  const newInquiryCount = inquiries.filter((row) => row.status === 'new').length;
  const pendingAnalysisCount = currentAnalyses.filter((row) => row.status === 'pending').length;
  const openActionCount = actions.filter((row) => row.status !== 'done' && row.status !== 'completed').length;
  const alerts: OperationalAlert[] = [];
  if (newInquiryCount > 0) alerts.push({ key: 'new-inquiries', severity: 'high', title: '신규 문의 확인 필요', detail: `아직 처리되지 않은 신규 문의 ${newInquiryCount}건`, count: newInquiryCount });
  if (pendingAnalysisCount > 0) alerts.push({ key: 'pending-analyses', severity: 'medium', title: 'AI 분석 승인 대기', detail: `관리자 검토가 필요한 분석 ${pendingAnalysisCount}건`, count: pendingAnalysisCount });
  if (openActionCount > 0) alerts.push({ key: 'open-actions', severity: 'medium', title: '후속조치 미완료', detail: `상담 액션 아이템 ${openActionCount}건이 남아 있습니다`, count: openActionCount });
  if (unclassifiedInquiries > 0) alerts.push({ key: 'unclassified-attribution', severity: 'info', title: '유입정보 미분류', detail: `source·medium·campaign이 없는 문의 ${unclassifiedInquiries}건`, count: unclassifiedInquiries });
  if (previous7.inquiries >= 3 && last7ConsultationRate + 10 < previous7ConsultationRate) {
    alerts.push({ key: 'conversion-drop', severity: 'high', title: '상담 전환율 하락', detail: `최근 7일 ${last7ConsultationRate}% · 직전 7일 ${previous7ConsultationRate}%` });
  }

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      inquiries: inquiries.length,
      newInquiries: inquiries.filter((row) => row.status === 'new').length,
      consultations: sessions.length,
      consultedInquiries: consultedInquiryIds.size,
      consultationRate: percentage(consultedInquiryIds.size, inquiries.length),
      analyses: currentAnalyses.length,
      analysisCoverage: percentage(currentAnalyses.length, sessions.length),
      pendingAnalyses: currentAnalyses.filter((row) => row.status === 'pending').length,
      highIntent: signals.filter((signal) => signal === 'high').length,
      activeStudents: actors.filter((row) => row.status !== 'archived').length,
      openActions: actions.filter((row) => row.status !== 'done' && row.status !== 'completed').length,
      enrollments: enrollments.length,
      confirmedEnrollments: enrollments.filter((row) => row.status === 'enrolled' || row.status === 'completed').length,
      paidRevenue: [...paidByEnrollment.values()].reduce((sum, amount) => sum + amount, 0),
      adSpendCurrentMonth,
      adSpendAllTime,
      inquiriesCurrentMonth,
      confirmedEnrollmentsCurrentMonth,
      paidRevenueCurrentMonth,
      cplCurrentMonth: adSpendCurrentMonth > 0 && inquiriesCurrentMonth > 0 ? Math.round(adSpendCurrentMonth / inquiriesCurrentMonth) : null,
      cpaCurrentMonth: adSpendCurrentMonth > 0 && confirmedEnrollmentsCurrentMonth > 0 ? Math.round(adSpendCurrentMonth / confirmedEnrollmentsCurrentMonth) : null,
      roasCurrentMonth: adSpendCurrentMonth > 0 ? Math.round((paidRevenueCurrentMonth / adSpendCurrentMonth) * 100) / 100 : null,
      cpl: adSpendAllTime > 0 && inquiries.length > 0 ? Math.round(adSpendAllTime / inquiries.length) : null,
      cpa: adSpendAllTime > 0 && enrollments.filter((row) => row.status === 'enrolled' || row.status === 'completed').length > 0
        ? Math.round(adSpendAllTime / enrollments.filter((row) => row.status === 'enrolled' || row.status === 'completed').length)
        : null,
      roas: adSpendAllTime > 0 ? Math.round((([...paidByEnrollment.values()].reduce((sum, amount) => sum + amount, 0) / adSpendAllTime) * 100)) / 100 : null,
      homepageClicks: operationalLinkClicks.filter((row) => row.destination === 'homepage').length,
      kakaoClicks: operationalLinkClicks.filter((row) => row.destination === 'kakao').length,
    },
    marketing: selectedMarketing,
    campaigns: rank(
      selectedInquiries.map((row) => meaningful(row.campaign, '')).filter(Boolean),
      8
    ),
    conversionSignals: rank(signals.map((signal) => signalLabels[signal] ?? signal), 4),
    needs: rank(structuredResults.flatMap((result) => stringList(result.needs))),
    painPoints: rank(structuredResults.flatMap((result) => stringList(result.pain_points))),
    recommendedPrograms: rank(
      structuredResults.map((result) => meaningful(result.recommended_program, '')).filter(Boolean)
    ),
    riskFlags: rank(structuredResults.flatMap((result) => stringList(result.risk_flags))),
    cohorts,
    periods: {
      last7,
      previous7,
      last30: snapshot(0, 30),
      previous30: snapshot(30, 30),
    },
    inboundClicks: selectedInboundClicks,
    ctaPlacements: selectedCtaPlacements,
    trend,
    filters: { period: selectedPeriod, channel: selectedChannel, campaign: selectedCampaign, channels: availableChannels, campaigns: availableCampaigns },
    selected: {
      inquiries: selectedInquiries.length,
      consultations: selectedConsultations,
      consultationRate: selectedConsultationRate,
      confirmedEnrollments: selectedConfirmedEnrollments,
      paidRevenue: selectedRevenue,
      adSpend: selectedSpend,
      homepageClicks: selectedClicks.filter((row) => row.destination === 'homepage').length,
      kakaoClicks: selectedClicks.filter((row) => row.destination === 'kakao').length,
      cpl: selectedCpl,
      cpa: selectedCpa,
      roas: selectedRoas,
    },
    alerts,
    legacy: {
      consultations: legacyConsultations,
      studentProfiles: legacyStudentProfiles,
      referenceConversionRate: percentage(legacyStudentProfiles, legacyConsultations),
      unmatched: legacyRows.filter((row) => row.match_status === 'unmatched').length,
    },
  };
}
