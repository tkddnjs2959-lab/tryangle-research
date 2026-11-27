'use client';
import { useState } from 'react';
import { saveStudentPreferences } from './preferences-actions';
import type { CoachingStudentRow } from '@/lib/admin-data';
import styles from '../admin.module.css';

const plans = { one_lead: '1:1 대표', one_team: '1:1 소속', pair_once: '2:1 주 1회', pair_twice: '2:1 주 2회' };
const days = ['일','월','화','수','목','금','토'];

export default function StudentDetails({ student }: { student: CoachingStudentRow }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState(student.preferredSlots ?? []);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [error, setError] = useState('');
  return <>
    <button type="button" className={styles.btn} onClick={() => setOpen(true)}>{student.name}</button>
    {open && <div role="presentation" style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,.75)', display:'grid', placeItems:'center', padding:16 }} onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label={student.name + ' 학생 상세'} onClick={event => event.stopPropagation()} className={styles.block} style={{ width:'min(680px,100%)', maxHeight:'90vh', overflow:'auto' }}>
        <button type="button" className={styles.btn} onClick={() => setOpen(false)}>닫기</button>
        <h2>{student.name} 학생 정보</h2>
        <form action={async form => { try { await saveStudentPreferences(form); setError(''); setOpen(false); } catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다.'); } }} className={styles.addForm}>
          <input type="hidden" name="id" value={student.id}/>
          <label>이름<input className={styles.input} name="name" required defaultValue={student.name}/></label>
          <label>연락처<input className={styles.input} name="contact" defaultValue={student.contact ?? ''}/></label>
          <label>출생년도<input className={styles.input} name="birthYear" type="number" defaultValue={student.birthYear ?? ''}/></label>
          <label>성별<select className={styles.input} name="gender" defaultValue={student.gender}><option value="female">여성</option><option value="male">남성</option></select></label>
          <label>사는 곳<input className={styles.input} name="residence" defaultValue={student.residence ?? ''}/></label>
          <label>수강 상품<select className={styles.input} name="lessonPlan" defaultValue={student.lessonPlan ?? ''}><option value="">미정</option>{Object.entries(plans).map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label>담임 선생님<select className={styles.input} name="homeroomTeacher" defaultValue={student.homeroomTeacher ?? ''}><option value="">미배정</option><option>이주아 T</option><option>김유리 T</option></select></label>
          <label>메모<textarea className={styles.input} name="note" defaultValue={student.note ?? ''}/></label>
          <div><strong>가능한 요일과 시간</strong>
            <div className={styles.summary}><select value={day} onChange={e => setDay(Number(e.target.value))}>{days.map((name,index) => <option key={index} value={index}>{name}요일</option>)}</select>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}/><input type="time" value={end} onChange={e => setEnd(e.target.value)}/>
              <button type="button" onClick={() => { if (start < end && !slots.some(s => s.day === day && s.start === start && s.end === end)) setSlots([...slots,{day,start,end}]); }}>시간 추가</button>
            </div>
            {slots.map((slot,index) => <span key={index} style={{ display:'inline-block', margin:6 }}>{days[slot.day]}요일 {slot.start}–{slot.end}<input type="hidden" name="slot" value={slot.day + '|' + slot.start + '|' + slot.end}/><button type="button" onClick={() => setSlots(slots.filter((_,i) => i !== index))}>×</button></span>)}
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit">저장</button>
        </form>
      </section>
    </div>}
  </>;
}
