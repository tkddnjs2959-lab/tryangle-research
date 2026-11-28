import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';
import AdminTabs from '../AdminTabs';
import { logout } from '../actions';
import { saveConsultation } from './actions';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '상담·시작일 달력 · 어드민', robots: { index: false, follow: false } };
const consultationStatus: Record<string,string> = { planned:'예정', done:'완료', canceled:'취소' };
const dateInSeoul = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const ym = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0,7);

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; kind?: string; day?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');
  const params = await searchParams;
  const today = dateInSeoul();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? '') ? params.month! : today.slice(0,7);
  const [year, monthNumber] = month.split('-').map(Number);
  const previous = ym(year, monthNumber - 1);
  const next = ym(year, monthNumber + 1);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthEnd = month + '-' + String(lastDay).padStart(2,'0');
  const kind = ['all','consultation','start'].includes(params.kind ?? '') ? params.kind! : 'all';
  const selectedDay = params.day?.startsWith(month + '-') && params.day <= monthEnd ? params.day : today.startsWith(month) ? today : month + '-01';
  const client = db();
  const [studentsResult, sessionsResult, consultationsResult] = await Promise.all([
    client.from('coaching_students').select('id, name, contact, status, first_start_date').neq('status','archived').order('name', { ascending:true }).limit(5000),
    client.from('lesson_sessions').select('student_id, lesson_date').order('lesson_date', { ascending:true }).limit(10000),
    client.from('coaching_consultations').select('id, student_id, consultation_date, consultation_time, status, teacher, note, follow_up_date, next_action').gte('consultation_date',month+'-01').lte('consultation_date',monthEnd).order('consultation_date', { ascending:true }).limit(5000),
  ]);
  if (studentsResult.error || sessionsResult.error || consultationsResult.error) throw new Error('달력 정보를 불러오지 못했습니다.');
  const students = studentsResult.data ?? [];
  const byId = new Map(students.map(s => [s.id,s]));
  const earliest = new Map<string,string>();
  for (const session of sessionsResult.data ?? []) if (!earliest.has(session.student_id)) earliest.set(session.student_id, session.lesson_date);
  const starts = students.map(s => ({ student:s, date:s.first_start_date ?? earliest.get(s.id) })).filter(x => x.date?.startsWith(month));
  const consultations = (consultationsResult.data ?? []).filter(c => byId.has(c.student_id));
  const events = [
    ...(kind !== 'start' ? consultations.map(c => ({ id:c.id, date:c.consultation_date, label:byId.get(c.student_id)!.name, type:'상담', detail:c, studentId:c.student_id })) : []),
    ...(kind !== 'consultation' ? starts.map(x => ({ id:'start-'+x.student.id, date:x.date!, label:x.student.name, type:'첫 수업', detail:null, studentId:x.student.id })) : []),
  ];
  const byDate = new Map<string, typeof events>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []),event]);
  const leading = new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay();
  const cells = Array.from({length: Math.ceil((leading+lastDay)/7)*7},(_,i) => i-leading+1);
  return <main className={styles.page}>
    <header className={styles.topbar}><div><div className={styles.brand}>JAUT 매체연기</div><h1 className={styles.h1}>상담·시작일 달력</h1></div><form action={logout}><button className={styles.btn}>로그아웃</button></form></header>
    <AdminTabs active="calendar"/>
    <section className={styles.block}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:10, justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}><Link className={styles.btn} href={`/admin/calendar?month=${previous}&kind=${kind}`}>‹ 이전 달</Link><h2 style={{ margin:0 }}>{year}년 {monthNumber}월</h2><Link className={styles.btn} href={`/admin/calendar?month=${next}&kind=${kind}`}>다음 달 ›</Link></div>
        <div style={{ display:'flex', gap:6 }}>{[['all','전체'],['consultation','상담'],['start','첫 수업']].map(([value,label]) => <Link key={value} className={styles.btn} style={{ opacity:kind === value ? 1 : .55 }} href={`/admin/calendar?month=${month}&kind=${value}`}>{label}</Link>)}</div>
      </div>
      <p style={{ margin:'12px 0', color:'#705e6a' }}>상담 {consultations.length}건 · 첫 수업 {starts.length}명 · 날짜를 누르면 아래에서 상담을 추가할 수 있습니다.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', border:'1px solid #e8dfe5', borderRadius:12, overflow:'hidden', background:'#fff' }}>
        {['일','월','화','수','목','금','토'].map(d => <strong key={d} style={{ textAlign:'center', padding:8, background:'#f9edf4', color:'#4b3040' }}>{d}</strong>)}
        {cells.map((day,i) => { const date = month+'-'+String(day).padStart(2,'0'); return <div key={i} style={{ minHeight:100, minWidth:0, padding:5, borderTop:'1px solid #eee4ea', borderRight:'1px solid #eee4ea', background:day < 1 || day > lastDay ? '#f8f6f7' : date === today ? '#fff8e8' : '#fff' }}>
          {day >= 1 && day <= lastDay && <><Link href={`/admin/calendar?month=${month}&kind=${kind}&day=${date}`} style={{ fontWeight:700, color:'#372435' }}>{day}</Link><div style={{ display:'grid', gap:3, marginTop:5 }}>{(byDate.get(date) ?? []).map(e => <Link key={e.id} href={`/admin/calendar?month=${month}&kind=${kind}&day=${date}`} style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderRadius:5, padding:'3px 5px', fontSize:11, background:e.type === '상담' ? '#fbe4f0' : '#e1f1fa', color:'#392b37' }}>{e.type} · {e.label}</Link>)}</div></>}
        </div>; })}
      </div>
    </section>
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>{selectedDay} 일정</h2>
      <div style={{ display:'grid', gap:8 }}>
        {(byDate.get(selectedDay) ?? []).length === 0 && <p>등록된 일정이 없습니다.</p>}
        {(byDate.get(selectedDay) ?? []).map(e => <div key={e.id} style={{ padding:10, border:'1px solid #eadde5', borderRadius:9, background:'#fff' }}>
          <strong>{e.type} · {e.label}</strong> {e.detail ? <span> {e.detail.consultation_time?.slice(0,5) ?? ''} · {consultationStatus[e.detail.status] ?? e.detail.status} {e.detail.teacher ?? ''}</span> : null}
          {e.detail?.note && <p style={{ whiteSpace:'pre-wrap' }}>{e.detail.note}</p>}
          {e.detail?.next_action && <p>후속 조치: {e.detail.next_action} {e.detail.follow_up_date ?? ''}</p>}
          <Link href={`/admin/coaching?q=${encodeURIComponent(e.label)}`}>학생 상세 보기</Link>
          {e.detail && <form action={saveConsultation} style={{ display:'flex', gap:6, marginTop:6 }}>
            {Object.entries({id:e.detail.id,studentId:e.studentId,date:e.date,time:e.detail.consultation_time?.slice(0,5) ?? '',teacher:e.detail.teacher ?? '',note:e.detail.note ?? '',followUpDate:e.detail.follow_up_date ?? '',nextAction:e.detail.next_action ?? ''}).map(([k,v]) => <input key={k} type="hidden" name={k} value={v}/>)}
            <select className={styles.input} name="status" defaultValue={e.detail.status} aria-label="상담 상태"><option value="planned">예정</option><option value="done">완료</option><option value="canceled">취소</option></select><button className={styles.btn}>상태 저장</button>
          </form>}
        </div>)}
      </div>
      <h3>상담 추가</h3>
      <form action={saveConsultation} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:9 }}>
        <label>기존 학생 선택<select className={styles.input} name="studentId" defaultValue=""><option value="">새 상담자 등록</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}{s.contact ? ' · '+s.contact : ''}</option>)}</select></label>
        <label>새 상담자 이름<input className={styles.input} name="name" placeholder="새 상담자일 때 입력" maxLength={120}/></label>
        <label>연락처<input className={styles.input} name="contact" maxLength={120}/></label>
        <label>날짜<input className={styles.input} name="date" type="date" defaultValue={selectedDay} required/></label>
        <label>시간<input className={styles.input} name="time" type="time"/></label>
        <label>담당<select className={styles.input} name="teacher"><option value="">미정</option><option>이주아 T</option><option>김유리 T</option></select></label>
        <label>상태<select className={styles.input} name="status"><option value="planned">예정</option><option value="done">완료</option><option value="canceled">취소</option></select></label>
        <label>다음 연락일<input className={styles.input} name="followUpDate" type="date"/></label>
        <label style={{ gridColumn:'1 / -1' }}>상담 내용<textarea className={styles.input} name="note" maxLength={3000}/></label>
        <label style={{ gridColumn:'1 / -1' }}>후속 조치<input className={styles.input} name="nextAction" maxLength={500}/></label>
        <button className={styles.btn}>상담 저장</button>
      </form>
    </section>
  </main>;
}
