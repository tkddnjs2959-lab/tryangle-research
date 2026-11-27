'use client';
import { useMemo, useState } from 'react';
import { saveSession, removeSession } from './actions';
import styles from '../../admin.module.css';

type Slot = { day: number; start: string; end: string };
type Student = { id: string; name: string; lesson_plan: string | null; homeroom_teacher: string | null; preferred_slots: Slot[] | null };
type Session = { id: string; lesson_date: string; start_time: string; end_time: string; teacher_name: string; student_id: string };
const teachers = ['이주아 T', '김유리 T'];
const colors: Record<string, string> = { '이주아 T': '#ec4899', '김유리 T': '#a78bfa' };
const plans: Record<string, string> = { one_lead:'1:1 대표', one_team:'1:1 소속', pair_once:'2:1 주 1회', pair_twice:'2:1 주 2회' };
const localDate = (date: Date) => date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');

export default function ScheduleBoard({ month, sessions, students }: { month: string; sessions: Session[]; students: Student[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const today = localDate(now);
    return today.startsWith(month) ? today : month + '-01';
  });
  const [start, setStart] = useState('13:00');
  const [end, setEnd] = useState('14:00');
  const [teacher, setTeacher] = useState('이주아 T');
  const [view, setView] = useState<'week' | 'month'>('week');
  const [week, setWeek] = useState(0);
  const [error, setError] = useState('');
  const names = new Map(students.map(student => [student.id, student]));
  const current = students.find(student => student.id === selected);
  const startOfWeek = useMemo(() => {
    const result = new Date(date + 'T12:00:00');
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7) + week * 7);
    return result;
  }, [date, week]);
  const days = Array.from({ length: view === 'week' ? 7 : new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate() }, (_, index) => {
    if (view === 'month') return month + '-' + String(index + 1).padStart(2,'0');
    const result = new Date(startOfWeek);
    result.setDate(result.getDate() + index);
    return localDate(result);
  });
  const choose = (id: string, day: string) => {
    const student = names.get(id);
    if (!student) return;
    setSelected(id);
    setDate(day);
    setWeek(0);
    setTeacher(student.lesson_plan === 'one_team' ? '김유리 T' : student.homeroom_teacher || '이주아 T');
  };
  const suggestions = current ? (current.preferred_slots ?? []).filter(slot => slot.day === new Date(date + 'T12:00:00').getDay()).map(slot => {
    const required = current.lesson_plan === 'one_lead' ? '이주아 T' : current.lesson_plan === 'one_team' ? '김유리 T' : null;
    const match = sessions.find(item => item.lesson_date === date && item.start_time.slice(0,5) >= slot.start && item.end_time.slice(0,5) <= slot.end && (!required || item.teacher_name === required) && current.lesson_plan?.startsWith('pair_') && names.get(item.student_id)?.lesson_plan?.startsWith('pair_') && sessions.filter(other => other.lesson_date === date && other.teacher_name === item.teacher_name && other.start_time === item.start_time && other.end_time === item.end_time).length < 2);
    return { slot, match };
  }) : [];
  const counts = new Map<string, number>();
  for (const item of sessions) counts.set(item.student_id, (counts.get(item.student_id) ?? 0) + 1);
  return <section className={styles.block}>
    <div className={styles.summary}>
      <button type="button" className={styles.btn} onClick={() => setView('week')}>주간</button>
      <button type="button" className={styles.btn} onClick={() => setView('month')}>월간</button>
      {view === 'week' && <><button type="button" className={styles.btn} onClick={() => setWeek(value => value - 1)}>이전 주</button><button type="button" className={styles.btn} onClick={() => setWeek(value => value + 1)}>다음 주</button></>}
    </div>
    <p>{teachers.map(name => <span key={name} style={{ color:colors[name], marginRight:16 }}>{name}</span>)}</p>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:8 }}>
      {days.map(day => <div key={day} style={{ border:'1px solid #666', padding:10, minHeight:100 }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.getData('text/plain'),day); }}>
        <button type="button" onClick={() => { setDate(day); setWeek(0); }}>{day}</button>
        {sessions.filter(item => item.lesson_date === day).sort((a,b) => a.start_time.localeCompare(b.start_time)).map(item => <div key={item.id} style={{ borderLeft:'4px solid ' + colors[item.teacher_name], padding:6, marginTop:6 }}>
          <b>{item.start_time.slice(0,5)}–{item.end_time.slice(0,5)}</b><br/>{item.teacher_name}<br/>{names.get(item.student_id)?.name ?? '학생'} · {plans[names.get(item.student_id)?.lesson_plan ?? ''] ?? '상품 미정'}
          <form action={removeSession}><input type="hidden" name="id" value={item.id}/><button type="submit">배정 취소</button></form>
        </div>)}
      </div>)}
    </div>
    <h2>학생 검색·배정</h2>
    <input className={styles.input} aria-label="학생 검색" placeholder="학생 이름 검색" value={query} onChange={event => setQuery(event.target.value)}/>
    <div className={styles.summary}>{students.filter(student => student.name.includes(query)).map(student => <button key={student.id} type="button" draggable onDragStart={event => event.dataTransfer.setData('text/plain',student.id)} onClick={() => choose(student.id,date)} className={styles.btn}>{student.name} · {plans[student.lesson_plan ?? ''] ?? '상품 미정'} · {counts.get(student.id) ?? 0}회</button>)}</div>
    <p>학생을 날짜에 놓거나 이름을 누른 뒤 날짜를 선택하세요. 희망 일정에 맞는 시간이 아래에 표시됩니다.</p>
    {current && <div><h3>{current.name} · {plans[current.lesson_plan ?? ''] ?? '상품 미정'} · 담임 {current.homeroom_teacher ?? '미배정'}</h3>
      {suggestions.length ? suggestions.map(({slot,match},index) => <button type="button" key={index} className={styles.btn} onClick={() => { setStart(match?.start_time.slice(0,5) ?? slot.start); setEnd(match?.end_time.slice(0,5) ?? slot.end); setTeacher(match?.teacher_name ?? (current.lesson_plan === 'one_team' ? '김유리 T' : current.homeroom_teacher || '이주아 T')); }}>{match ? '빈자리 추천' : '희망 시간'} · {slot.start}–{slot.end} {match ? '· ' + match.teacher_name : ''}</button>) : <p>선택한 날짜에 등록된 희망 시간이 없습니다. 직접 시간을 지정할 수 있습니다.</p>}
    </div>}
    <form action={async form => { try { await saveSession(form); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '배정하지 못했습니다.'); } }} className={styles.searchForm}>
      <input type="hidden" name="studentId" value={selected}/>
      <label>날짜 <input type="date" name="date" required value={date} onChange={event => { setDate(event.target.value); setWeek(0); }}/></label>
      <label>시작 <input type="time" name="start" required value={start} onChange={event => setStart(event.target.value)}/></label>
      <label>종료 <input type="time" name="end" required value={end} onChange={event => setEnd(event.target.value)}/></label>
      <label>수업 선생님 <select name="teacher" value={teacher} onChange={event => setTeacher(event.target.value)}>{teachers.map(name => <option key={name}>{name}</option>)}</select></label>
      <button type="submit" className={styles.btn} disabled={!selected}>시간표에 배정</button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
