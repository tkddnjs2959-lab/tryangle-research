'use client';
import { useMemo, useState } from 'react';
import { saveSession, removeSession } from './actions';
import styles from '../../admin.module.css';

type Student = { id: string; name: string };
type Session = { id: string; lesson_date: string; start_time: string; end_time: string; teacher_name: string; student_id: string };

export default function ScheduleBoard({ month, sessions, students }: { month: string; sessions: Session[]; students: Student[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [date, setDate] = useState(() => { const now = new Date(); const korea = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); const today = korea.getFullYear() + '-' + String(korea.getMonth()+1).padStart(2,'0') + '-' + String(korea.getDate()).padStart(2,'0'); return today.startsWith(month) ? today : month + '-01'; });
  const [start, setStart] = useState('13:00');
  const [end, setEnd] = useState('14:00');
  const [teacher, setTeacher] = useState('');
  const [view, setView] = useState<'week' | 'month'>('week');
  const [week, setWeek] = useState(0);
  const names = new Map(students.map(s => [s.id, s.name]));
  const assigned = new Set(sessions.map(s => s.student_id));
  const visibleStudents = students.filter(s => !assigned.has(s.id) && s.name.includes(query));
  const teachers = [...new Set(sessions.map(s => s.teacher_name))];
  const colors = ['#ec4899', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
  const startOfWeek = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + week * 7);
    return d;
  }, [date, week]);
  const days = Array.from({ length: view === 'week' ? 7 : new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate() }, (_, index) => {
    if (view === 'month') return month + '-' + String(index + 1).padStart(2, '0');
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + index);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });
  return <section className={styles.block}>
    <div className={styles.summary}>
      <button type="button" className={styles.btn} onClick={() => setView('week')}>주간</button>
      <button type="button" className={styles.btn} onClick={() => setView('month')}>월간</button>
      {view === 'week' && <><button type="button" className={styles.btn} onClick={() => setWeek(w => w - 1)}>이전 주</button><button type="button" className={styles.btn} onClick={() => setWeek(w => w + 1)}>다음 주</button></>}
    </div>
    <p>선생님별 색상 {teachers.map((name, index) => <span key={name} style={{ color: colors[index % colors.length], marginRight: 12 }}>{name}</span>)}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
      {days.map(day => <div key={day} style={{ border: '1px solid #666', padding: 10, minHeight: 90 }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (students.some(s => s.id === id)) { setSelected(id); setDate(day); } }}>
        <strong>{day}</strong>
        {sessions.filter(s => s.lesson_date === day).sort((a,b) => a.start_time.localeCompare(b.start_time)).map(s => <div key={s.id} style={{ borderLeft: '4px solid ' + colors[teachers.indexOf(s.teacher_name) % colors.length], padding: 6, marginTop: 6 }}>
          <b>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</b><br />{s.teacher_name} · {names.get(s.student_id) ?? '학생'}
          <form action={removeSession}><input type="hidden" name="id" value={s.id}/><button type="submit">배정 취소</button></form>
        </div>)}
      </div>)}
    </div>
    <h2>미배정 학생</h2>
    <input className={styles.input} placeholder="학생 검색" aria-label="학생 검색" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className={styles.summary}>{visibleStudents.map(s => <button key={s.id} type="button" draggable onDragStart={e => e.dataTransfer.setData('text/plain', s.id)} onClick={() => setSelected(s.id)} className={styles.btn}>{s.name}</button>)}</div>
    <p>학생을 날짜로 끌어놓거나 선택한 뒤 시간과 선생님을 입력하세요.</p>
    <form action={saveSession} className={styles.searchForm}>
      <label>학생 <select className={styles.input} name="studentId" required value={selected} onChange={e => setSelected(e.target.value)}><option value="">선택</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>날짜 <input type="date" name="date" required value={date} onChange={e => { setDate(e.target.value); setWeek(0); }}/></label>
      <label>시작 <input type="time" name="start" required value={start} onChange={e => setStart(e.target.value)}/></label>
      <label>종료 <input type="time" name="end" required value={end} onChange={e => setEnd(e.target.value)}/></label>
      <label>선생님 <input className={styles.input} name="teacher" required value={teacher} onChange={e => setTeacher(e.target.value)}/></label>
      <button className={styles.btn} type="submit">시간표에 배정</button>
    </form>
  </section>;
}
