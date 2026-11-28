import Link from 'next/link';
import { redirect } from 'next/navigation';
import { trainerIdentity } from '@/lib/trainer-auth';
import { db } from '@/lib/supabase';
import { trainerLogout, trainerRecordTuition } from './actions';
import styles from '../admin/admin.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'내 수업·학생 · JAUT 매체연기',robots:{index:false,follow:false}};
const plans:Record<string,string>={one_lead:'1:1 대표',one_team:'1:1 소속',pair_once:'2:1 주 1회',pair_twice:'2:1 주 2회'};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export default async function TrainerPage({searchParams}:{searchParams:Promise<{month?:string;tab?:string;student?:string}>}) {
  const me=await trainerIdentity();
  if (!me) redirect('/trainer/login');
  const params=await searchParams;
  const month=/^20\d{2}-(0[1-9]|1[0-2])$/.test(params.month??'')?params.month!:today().slice(0,7);
  const tab=['schedule','students','receipts'].includes(params.tab??'')?params.tab!:'schedule';
  const first=month+'-01';
  const next=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)).toISOString().slice(0,10);
  const client=db();
  const [ownedResult,sessionsResult,registrationsResult]=await Promise.all([
    client.from('coaching_students').select('id,name,contact,birth_year,gender,residence,status,lesson_plan,homeroom_teacher,assistant_teacher').or(`homeroom_teacher.eq.${me.teacherName},assistant_teacher.eq.${me.teacherName}`).neq('status','archived').order('name').limit(5000),
    client.from('lesson_sessions').select('id,student_id,lesson_date,start_time,end_time,teacher_name,coaching_students(name,lesson_plan)').gte('lesson_date',first).lt('lesson_date',next).order('lesson_date').order('start_time').limit(5000),
    tab==='receipts'?client.from('coaching_monthly_registrations').select('student_id,paid_date').eq('service_month',first).limit(5000):null,
  ]);
  if (ownedResult.error || sessionsResult.error || registrationsResult?.error) throw new Error('트레이너 자료를 불러오지 못했습니다.');
  const owned=ownedResult.data??[];
  const ownedIds=new Set(owned.map(s=>s.id));
  const sessions=sessionsResult.data??[];
  const registrations=new Map((registrationsResult?.data??[]).filter(r=>ownedIds.has(r.student_id)).map(r=>[r.student_id,r.paid_date]));
  const selected=owned.find(s=>s.id===params.student);
  const dates=[...new Set(sessions.map(s=>s.lesson_date))];
  return <main className={styles.page}>
    <header className={styles.topbar}><div><div className={styles.brand}>JAUT 매체연기</div><h1 className={styles.h1}>{me.displayName} · 트레이너</h1></div><form action={trainerLogout}><button className={styles.btn}>로그아웃</button></form></header>
    <nav className={styles.tabs}>{[['schedule','시간표'],['students','내 학생'],['receipts','내 수납']].map(([key,label])=><Link className={`${styles.tab} ${tab===key?styles.tabOn:''}`} key={key} href={`/trainer?tab=${key}&month=${month}`}>{label}</Link>)}</nav>
    {(tab==='schedule'||tab==='receipts')&&<form><input type="hidden" name="tab" value={tab}/><label>조회 월 <input type="month" name="month" defaultValue={month}/></label><button className={styles.btn}>조회</button></form>}
    {tab==='schedule'&&<section className={styles.block}><h2>{month} 전체 시간표</h2><p>시간표는 조회만 가능합니다. 담당하지 않은 학생의 상세 정보는 표시되지 않습니다.</p>
      {dates.map(date=><div key={date} style={{margin:'14px 0'}}><h3>{date} ({['일','월','화','수','목','금','토'][new Date(date+'T12:00:00Z').getUTCDay()]})</h3><div style={{display:'grid',gap:6}}>{sessions.filter(s=>s.lesson_date===date).map(s=>{
        const linked=s.coaching_students as unknown as {name:string;lesson_plan:string|null}|null;
        return <div key={s.id} style={{padding:9,borderLeft:'4px solid '+(s.teacher_name==='김유리 T'?'#60a5fa':'#ec4899'),background:s.teacher_name==='김유리 T'?'#eff6ff':'#fdf2f8',borderRadius:6}}>
          {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)} · <strong>{linked?.name??'학생'}</strong> · {s.teacher_name} · {plans[linked?.lesson_plan??'']??'수업'}
          {ownedIds.has(s.student_id)&&<Link style={{marginLeft:8}} href={`/trainer?tab=students&student=${s.student_id}`}>담당 학생 정보</Link>}
        </div>;
      })}</div></div>)}
      {!sessions.length&&<p>해당 월에 배정된 수업이 없습니다.</p>}
    </section>}
    {tab==='students'&&<section className={styles.block}><h2>담당 학생 {owned.length}명</h2><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{owned.map(s=><Link key={s.id} className={styles.btn} href={`/trainer?tab=students&student=${s.id}`}>{s.name}</Link>)}</div>
      {selected&&<article style={{marginTop:16,padding:16,border:'1px solid #eadde5',borderRadius:10}}>
        <h3>{selected.name} · {selected.status==='active'?'수강생':selected.status==='waitlist'?'대기생':selected.status}</h3>
        <p>연락처 {selected.contact??'미입력'} · 출생년도 {selected.birth_year??'미입력'} · 성별 {selected.gender==='female'?'여':'남'} · 사는 곳 {selected.residence??'미입력'}</p>
        <p>수강 구분 {plans[selected.lesson_plan??'']??'미정'} · 담임 {selected.homeroom_teacher??'미배정'} · 부담임 {selected.assistant_teacher??'미배정'}</p>
        <p>이번 달 배정 {sessions.filter(s=>s.student_id===selected.id).length}타임</p>
      </article>}
    </section>}
    {tab==='receipts'&&<section className={styles.block}><h2>{month} 담당 학생 수납</h2><p>담당 학생의 납부 여부만 확인합니다. 일자를 저장하면 수납 완료로 표시되고 변경 이력이 남습니다.</p><div style={{overflowX:'auto'}}><table className={styles.table}><thead><tr><th>학생</th><th>배정 타임</th><th>상태</th><th>납부일</th></tr></thead><tbody>
      {owned.filter(s=>sessions.some(x=>x.student_id===s.id)||registrations.has(s.id)).sort((a,b)=>Number(Boolean(registrations.get(a.id)))-Number(Boolean(registrations.get(b.id)))||a.name.localeCompare(b.name,'ko')).map(s=><tr key={s.id}>
        <td>{s.name}</td><td>{sessions.filter(x=>x.student_id===s.id).length}</td><td>{registrations.get(s.id)?'납부 완료':'미납'}</td>
        <td><form action={trainerRecordTuition}><input type="hidden" name="studentId" value={s.id}/><input type="hidden" name="month" value={month}/><input type="date" name="paidDate" defaultValue={registrations.get(s.id)??''}/><button className={styles.btn}>저장</button></form></td>
      </tr>)}</tbody></table></div></section>}
  </main>;
}
