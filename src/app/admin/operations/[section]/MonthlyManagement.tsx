import { db } from '@/lib/supabase';
import { recordTuition } from './tuition-actions';
import styles from '../../admin.module.css';

const plans: Record<string,string> = {one_lead:'1:1 대표',one_team:'1:1 소속',pair_once:'2:1 주 1회',pair_twice:'2:1 주 2회'};
type Student = { id:string; name:string; lesson_plan:string|null; homeroom_teacher:string|null; monthly_tuition:number|null };
type Registration = { student_id:string; service_month:string; paid_date:string|null; lesson_plan:string|null; teacher:string|null; tuition:number|null };
type Session = { student_id:string; lesson_date:string; tuition_amount:number|null; tuition_session_count:number|null };

export default async function MonthlyManagement({month, section}: {month:string; section:'receipts'|'closing'}) {
  const end = new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)).toISOString().slice(0,10);
  const from = new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-12,1)).toISOString().slice(0,10);
  const [studentsResult, registrationsResult, sessionsResult] = await Promise.all([
    db().from('coaching_students').select('id,name,lesson_plan,homeroom_teacher,monthly_tuition').order('name').limit(10000),
    db().from('coaching_monthly_registrations').select('student_id,service_month,paid_date,lesson_plan,teacher,tuition').lt('service_month',end).limit(10000),
    db().from('lesson_sessions').select('student_id,lesson_date,tuition_amount,tuition_session_count').gte('lesson_date',from).lt('lesson_date',end).limit(10000),
  ]);
  if (studentsResult.error || registrationsResult.error || sessionsResult.error) throw new Error('월별 관리 정보를 불러오지 못했습니다.');
  const students = (studentsResult.data ?? []) as Student[];
  const registrations = (registrationsResult.data ?? []) as Registration[];
  const sessions = (sessionsResult.data ?? []) as Session[];
  const monthSessions = sessions.filter(s => s.lesson_date.startsWith(month));
  const registration = (id:string, m:string) => registrations.find(r => r.student_id === id && r.service_month.slice(0,7) === m);
  const activeIds = new Set(monthSessions.map(s => s.student_id));
  const monthRegs = registrations.filter(r => r.service_month.startsWith(month));
  const rows = students.filter(s => activeIds.has(s.id) || monthRegs.some(r => r.student_id === s.id)).map(s => ({ student:s, reg:registration(s.id,month), count:monthSessions.filter(x => x.student_id === s.id).length })).sort((a,b) => Number(Boolean(a.reg?.paid_date))-Number(Boolean(b.reg?.paid_date)) || b.count-a.count || a.student.name.localeCompare(b.student.name,'ko'));
  const last = new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-2,1)).toISOString().slice(0,7);
  const previous = new Set(sessions.filter(s => s.lesson_date.startsWith(last)).map(s => s.student_id));
  const retained = [...previous].filter(id => Boolean(registration(id,month)?.paid_date)).length;
  const paid = registrations.filter(r => r.paid_date);
  const average = (ids:string[], teacher?:string) => ids.length ? (ids.reduce((sum,id) => sum + paid.filter(r => r.student_id === id && (!teacher || r.teacher === teacher)).length,0)/ids.length).toFixed(1) : '0.0';
  const months = Array.from({length:12},(_,i) => new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-12+i,1)).toISOString().slice(0,7));
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const totals = months.map(m => sessions.filter(s => s.lesson_date.startsWith(m)).reduce((sum, s) => {
    const student = students.find(x => x.id === s.student_id);
    const amount = s.tuition_amount ?? student?.monthly_tuition;
    const count = s.tuition_session_count ?? (student?.lesson_plan === 'pair_twice' ? 8 : student?.lesson_plan ? 4 : null);
    const value = amount != null && count ? amount / count : 0;
    return s.lesson_date < today
      ? { confirmed: sum.confirmed + value, estimated: sum.estimated }
      : { confirmed: sum.confirmed, estimated: sum.estimated + value };
  }, { confirmed: 0, estimated: 0 }));
  const selected = totals[months.indexOf(month)] ?? { confirmed: 0, estimated: 0 };
  const max = Math.max(...totals.map(total => total.confirmed + total.estimated),1);
  if (section === 'receipts') return <section className={styles.block}><h2>월 수납 관리</h2><p>수업이 배정된 미납 학생부터 표시합니다. 날짜를 입력하면 납부 완료로 기록합니다.</p><div style={{overflowX:'auto'}}><table className={styles.table}><thead><tr><th>학생</th><th>수강 구분</th><th>담임</th><th>월 수강료</th><th>배정</th><th>납부일</th><th>상태</th></tr></thead><tbody>{rows.map(({student:s,reg,count}) => <tr key={s.id}><td>{s.name}</td><td>{plans[reg?.lesson_plan ?? s.lesson_plan ?? ''] ?? '미설정'}</td><td>{reg?.teacher ?? s.homeroom_teacher ?? '미배정'}</td><td>{(reg?.tuition ?? s.monthly_tuition)?.toLocaleString('ko-KR') ?? '미설정'}</td><td>{count}타임</td><td><form action={recordTuition}><input type="hidden" name="studentId" value={s.id}/><input type="hidden" name="month" value={month}/><input type="date" name="paidDate" defaultValue={reg?.paid_date ?? ''}/><button type="submit">저장</button></form></td><td>{reg?.paid_date ? (registration(s.id,last)?.paid_date ? '재등록' : registrations.some(r => r.student_id===s.id && r.paid_date && r.service_month < month+'-01') ? '복귀' : '신규') : '미납'}</td></tr>)}</tbody></table></div>{rows.length===0 && <p>이 달의 수업 배정이나 수납 기록이 없습니다.</p>}</section>;
  return <section className={styles.block}><h2>월별 수업 매출</h2><p>선택한 월 확정 {Math.round(selected.confirmed).toLocaleString('ko-KR')}원 · 예상 {Math.round(selected.estimated).toLocaleString('ko-KR')}원 · 합계 {Math.round(selected.confirmed + selected.estimated).toLocaleString('ko-KR')}원</p><p>배정된 수업일이 지나면 확정, 오늘과 이후는 예상으로 표시합니다. 회당 금액은 월 수강료를 4타임 또는 8타임으로 나눕니다.</p><div style={{display:'flex',alignItems:'end',gap:8,height:180,overflowX:'auto'}}>{months.map((m,i)=><div key={m} style={{minWidth:55,textAlign:'center',fontSize:12}}><div>{Math.round(totals[i].confirmed + totals[i].estimated).toLocaleString()}원</div><div title={'예상 ' + Math.round(totals[i].estimated).toLocaleString() + '원'} style={{height:totals[i].estimated/max*125,background:'#93c5fd',borderRadius:'4px 4px 0 0'}}/><div title={'확정 ' + Math.round(totals[i].confirmed).toLocaleString() + '원'} style={{height:totals[i].confirmed/max*125,background:'#d83d8b'}}/><div>{m.slice(2)}</div></div>)}</div><h2>학생 현황</h2><p>수업 배정 학생 {activeIds.size}명 · 재등록 {retained}/{previous.size}명 ({previous.size ? Math.round(retained/previous.size*100) : 0}%) · 평균 등록 {average([...activeIds])}개월</p><p>등록 기간은 기록된 납부 완료 월 수를 기준으로 합니다.</p><h3>수강 구분별</h3>{Object.entries(plans).map(([key,label]) => <span key={key} style={{marginRight:16}}>{label} {rows.filter(r => r.count && (r.reg?.lesson_plan ?? r.student.lesson_plan) === key).length}명</span>)}<h3>담임별</h3>{['이주아 T','김유리 T','미배정'].map(teacher => { const ids=rows.filter(r=>r.count && (r.reg?.teacher ?? r.student.homeroom_teacher ?? '미배정')===teacher).map(r=>r.student.id); return <p key={teacher}>{teacher} {ids.length}명 · 학생 평균 등록 {average(ids)}개월 · 해당 담임 등록 {average(ids,teacher)}개월</p>; })}</section>;
}
