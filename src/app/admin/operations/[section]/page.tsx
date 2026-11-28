import ScheduleBoard from './ScheduleBoard';
import { notFound, redirect } from 'next/navigation';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';
import AdminTabs from '../../AdminTabs';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

const sections = {
  schedule: '수업 시간표',
  receipts: '수납·미수',
  costs: '비용·수익성',
  closing: '월 마감',
} as const;

export default async function Page({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const identity = await currentAdminIdentity();
  if (!identity) redirect('/admin/login');
  const { section } = await params;
  if (!(section === 'schedule' || section === 'receipts' || section === 'costs' || section === 'closing')) notFound();
  const requested = (await searchParams).month;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const month = requested && /^20\d\d-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const start = month + '-01';
  const next = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 1)).toISOString().slice(0,10);
  const scheduleStart = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)) - 1, -6)).toISOString().slice(0,10);
  const scheduleEnd = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 8)).toISOString().slice(0,10);
  const needsPayments = section === 'receipts' || section === 'closing';
  const needsSpend = section === 'costs' || section === 'closing';
  const [payments, spend, scheduleData, studentsData, revenueData] = await Promise.all([
    needsPayments ? db().from('payments').select('paid_at, amount, currency, status').gte('paid_at', start+'T00:00:00+09:00').lt('paid_at', next+'T00:00:00+09:00').order('paid_at') : null,
    needsSpend ? db().from('marketing_spend_daily').select('spend_date, platform, spend').gte('spend_date', start).lt('spend_date', next).order('spend_date') : null,
    section === 'schedule' ? db().from('lesson_sessions').select('id, lesson_date, start_time, end_time, teacher_name, student_id').gte('lesson_date', scheduleStart).lt('lesson_date', scheduleEnd).order('lesson_date') : null,
    section === 'schedule' ? db().from('coaching_students').select('id, name, lesson_plan, homeroom_teacher, preferred_slots').neq('status', 'archived').order('name').limit(5000) : null,
    section === 'closing' ? db().from('lesson_sessions').select('id, lesson_date, student_id, tuition_amount, tuition_session_count, coaching_students(name, monthly_tuition, lesson_plan)').gte('lesson_date', start).lt('lesson_date', next).order('lesson_date').limit(10000) : null,
  ]);
  if (payments?.error || spend?.error || scheduleData?.error || studentsData?.error || revenueData?.error) throw new Error('월별 자료를 조회하지 못했습니다.');
  const scheduled = revenueData?.data ?? [];
  const effectiveRows = scheduled.map(row => {
    const student = row.coaching_students as unknown as { name: string; monthly_tuition: number | null; lesson_plan: string | null } | null;
    const amount = row.tuition_amount ?? student?.monthly_tuition ?? null;
    const count = row.tuition_session_count ?? (student?.lesson_plan === 'pair_twice' ? 8 : student?.lesson_plan ? 4 : null);
    return { ...row, student, amount, count, estimatedFromCurrent: row.tuition_amount === null && amount !== null };
  });
  const priced = effectiveRows.filter(row => row.amount !== null && row.count);
  const scheduledRevenue = priced.reduce((sum, row) => sum + Number(row.amount) / Number(row.count), 0);
  return <main className={styles.page}>
    <header className={styles.topbar}><h1 className={styles.h1}>{sections[section]}</h1></header>
    <AdminTabs active={section}/>
    <form className={styles.searchForm}><label>조회 월 <input type="month" name="month" defaultValue={month}/></label>
      <button className={styles.btn}>조회</button></form>
    {section === 'schedule' && <ScheduleBoard key={month} month={month} sessions={scheduleData?.data ?? []} students={studentsData?.data ?? []} /> }
    {section === 'closing' && <section className={styles.block}><h2 className={styles.blockTitle}>수업 배정 기준 월 예정 매출</h2><p>총 {scheduled.length}회 · 금액 설정 {priced.length}회 · {Math.round(scheduledRevenue).toLocaleString('ko-KR')}원</p><p>월 수강료를 주 1회 상품은 4회, 주 2회 상품은 8회로 나누어 배정된 회차별로 계산합니다. 예약과 결제·수업 완료 여부는 별도입니다.</p>{priced.length < scheduled.length && <p>수강료 정보가 없는 {scheduled.length - priced.length}회는 계산에서 제외됩니다.</p>}<table className={styles.table}><thead><tr><th>수업일</th><th>학생</th><th>회당 예정 매출</th></tr></thead><tbody>{effectiveRows.map(row => <tr key={row.id}><td>{row.lesson_date}</td><td>{row.student?.name ?? '학생'}</td><td>{row.amount !== null && row.count ? Math.round(row.amount / row.count).toLocaleString('ko-KR') + '원' + (row.estimatedFromCurrent ? ' (현재 수강료 기준)' : '') : '금액 미설정'}</td></tr>)}</tbody></table></section>}
    {needsPayments && <section><h2>결제 기록</h2>{payments?.data?.length ? <table><thead><tr><th>결제일</th><th>금액</th><th>상태</th></tr></thead><tbody>
      {payments.data.map((p,i) => <tr key={i}><td>{new Date(p.paid_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</td><td>{Number(p.amount).toLocaleString('ko-KR')} {p.currency}</td><td>{p.status}</td></tr>)}</tbody></table> : <p>해당 월의 결제 기록이 없습니다.</p>}
      {section === 'receipts' && <p>미수잔액은 청구 원장 연결 후 산출됩니다.</p>}</section>}
    {needsSpend && <section><h2>광고 집행 내역</h2>{spend?.data?.length ? <table><thead><tr><th>집행일</th><th>매체</th><th>금액</th></tr></thead><tbody>
      {spend.data.map((s,i) => <tr key={i}><td>{s.spend_date}</td><td>{s.platform}</td><td>{Number(s.spend).toLocaleString('ko-KR')}</td></tr>)}</tbody></table> : <p>해당 월의 광고 집행 기록이 없습니다.</p>}</section>}
  </main>;
}

