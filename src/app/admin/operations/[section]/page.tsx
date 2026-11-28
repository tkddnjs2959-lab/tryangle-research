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
  const [payments, spend, scheduleData, studentsData] = await Promise.all([
    needsPayments ? db().from('payments').select('paid_at, amount, currency, status').gte('paid_at', start+'T00:00:00+09:00').lt('paid_at', next+'T00:00:00+09:00').order('paid_at') : null,
    needsSpend ? db().from('marketing_spend_daily').select('spend_date, platform, spend').gte('spend_date', start).lt('spend_date', next).order('spend_date') : null,
    section === 'schedule' ? db().from('lesson_sessions').select('id, lesson_date, start_time, end_time, teacher_name, student_id').gte('lesson_date', scheduleStart).lt('lesson_date', scheduleEnd).order('lesson_date') : null,
    section === 'schedule' ? db().from('coaching_students').select('id, name, lesson_plan, homeroom_teacher, preferred_slots').neq('status', 'archived').order('name').limit(5000) : null,
  ]);
  if (payments?.error || spend?.error || scheduleData?.error || studentsData?.error) throw new Error('월별 자료를 조회하지 못했습니다.');
  return <main className={styles.page}>
    <header className={styles.topbar}><h1 className={styles.h1}>{sections[section]}</h1></header>
    <AdminTabs active={section}/>
    <form className={styles.searchForm}><label>조회 월 <input type="month" name="month" defaultValue={month}/></label>
      <button className={styles.btn}>조회</button></form>
    {section === 'schedule' && <ScheduleBoard key={month} month={month} sessions={scheduleData?.data ?? []} students={studentsData?.data ?? []} /> }
    {section === 'closing' && <p>마감 상태 미확정 · 현재는 결제와 광고비 기초자료를 조회할 수 있습니다.</p>}
    {needsPayments && <section><h2>결제 기록</h2>{payments?.data?.length ? <table><thead><tr><th>결제일</th><th>금액</th><th>상태</th></tr></thead><tbody>
      {payments.data.map((p,i) => <tr key={i}><td>{new Date(p.paid_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</td><td>{Number(p.amount).toLocaleString('ko-KR')} {p.currency}</td><td>{p.status}</td></tr>)}</tbody></table> : <p>해당 월의 결제 기록이 없습니다.</p>}
      {section === 'receipts' && <p>미수잔액은 청구 원장 연결 후 산출됩니다.</p>}</section>}
    {needsSpend && <section><h2>광고 집행 내역</h2>{spend?.data?.length ? <table><thead><tr><th>집행일</th><th>매체</th><th>금액</th></tr></thead><tbody>
      {spend.data.map((s,i) => <tr key={i}><td>{s.spend_date}</td><td>{s.platform}</td><td>{Number(s.spend).toLocaleString('ko-KR')}</td></tr>)}</tbody></table> : <p>해당 월의 광고 집행 기록이 없습니다.</p>}</section>}
  </main>;
}

