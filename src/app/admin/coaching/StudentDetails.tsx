'use client';
import { useState } from 'react';
import { saveStudentPreferences } from './preferences-actions';
import TuitionInput from './TuitionInput';
import type { CoachingStudentRow } from '@/lib/admin-data';
import styles from '../admin.module.css';

const plans = { one_lead: '1:1 대표', one_team: '1:1 소속', pair_once: '2:1 주 1회', pair_twice: '2:1 주 2회' };
const days = ['일','월','화','수','목','금','토'];
const fieldStyle = { display:'grid', gap:5, fontSize:12, fontWeight:700, color:'#5b3b4d' } as const;

export default function StudentDetails({ student }: { student: CoachingStudentRow }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState(student.preferredSlots ?? []);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [error, setError] = useState('');
  const status = ({ active: { label: '수강생', color: '#197047', background: '#e6f7ed' }, waitlist: { label: '대기생', color: '#9a3a76', background: '#fdeaf4' }, unregistered: { label: '미등록', color: '#815b15', background: '#fff4d8' }, prospective: { label: '미등록', color: '#815b15', background: '#fff4d8' }, leave: { label: '휴학생', color: '#315eaa', background: '#eaf2ff' }, withdrawn: { label: '퇴원생', color: '#66616b', background: '#f0eef2' }, done: { label: '퇴원생', color: '#66616b', background: '#f0eef2' }, archived: { label: '퇴원생', color: '#66616b', background: '#f0eef2' } } as Record<string, { label: string; color: string; background: string }>)[student.status] ?? { label: '미등록', color: '#815b15', background: '#fff4d8' };
  return <>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
      <button type="button" className={styles.btn} onClick={() => setOpen(true)}>{student.name}</button>
      <span aria-label={`학생 상태: ${status.label}`} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, lineHeight: 1.4, color: status.color, background: status.background }}>{status.label}</span>
    </span>
    {open && <div role="presentation" style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(17,10,16,.76)', display:'grid', placeItems:'center', padding:12 }} onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label={student.name + ' 학생 상세'} onClick={event => event.stopPropagation()} style={{ width:'min(960px,100%)', maxHeight:'calc(100vh - 24px)', overflowY:'auto', background:'#fff', color:'#271c25', borderRadius:18, boxShadow:'0 20px 60px rgba(0,0,0,.3)', padding:'clamp(16px,3vw,28px)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, borderBottom:'1px solid #f0e3eb', paddingBottom:12, marginBottom:14 }}>
          <div><h2 style={{ margin:0, fontSize:22 }}>{student.name} 학생 정보</h2><small style={{ color:'#765d6c' }}>기본 정보, 수강 조건, 가능한 시간을 한곳에서 수정합니다.</small></div>
          <button type="button" className={styles.btn} onClick={() => setOpen(false)}>닫기</button>
        </div>
        <form action={async form => { try { await saveStudentPreferences(form); setError(''); setOpen(false); } catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다.'); } }} style={{ display:'grid', gap:14 }}>
          <input type="hidden" name="id" value={student.id}/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))', gap:10 }}>
            <label style={fieldStyle}>이름<input className={styles.input} name="name" required defaultValue={student.name}/></label>
            <label style={fieldStyle}>연락처<input className={styles.input} name="contact" defaultValue={student.contact ?? ''}/></label>
            <label style={fieldStyle}>출생년도<input className={styles.input} name="birthYear" type="number" defaultValue={student.birthYear ?? ''}/></label>
            <label style={fieldStyle}>성별<select className={styles.input} name="gender" defaultValue={student.gender}><option value="female">여성</option><option value="male">남성</option></select></label>
            <label style={fieldStyle}>사는 곳<input className={styles.input} name="residence" defaultValue={student.residence ?? ''}/></label>
            <label style={fieldStyle}>학생 상태<select className={styles.input} name="status" defaultValue={student.status === 'done' || student.status === 'archived' ? 'withdrawn' : student.status === 'prospective' ? 'unregistered' : student.status}><option value="active">수강생</option><option value="waitlist">대기생</option><option value="unregistered">미등록</option><option value="leave">휴학생</option><option value="withdrawn">퇴원생</option></select></label>
            <label style={fieldStyle}>수강 상품<select className={styles.input} name="lessonPlan" defaultValue={student.lessonPlan ?? ''}><option value="">미정</option>{Object.entries(plans).map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select></label>
            <label style={fieldStyle}>월 수강료 (원)<TuitionInput initial={student.monthlyTuition?.toString() ?? ''}/></label>
            <label style={fieldStyle}>담임 선생님<select className={styles.input} name="homeroomTeacher" defaultValue={student.homeroomTeacher ?? ''}><option value="">미배정</option><option>이주아 T</option><option>김유리 T</option></select></label>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:14 }}>
            <div style={{ border:'1px solid #f0e3eb', borderRadius:12, padding:12, background:'#fffafd' }}>
              <strong>가능한 요일과 시간</strong>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                <select className={styles.input} aria-label="요일" value={day} onChange={e => setDay(Number(e.target.value))}>{days.map((name,index) => <option key={index} value={index}>{name}요일</option>)}</select>
                <input className={styles.input} aria-label="시작 시간" type="time" value={start} onChange={e => setStart(e.target.value)}/>
                <input className={styles.input} aria-label="종료 시간" type="time" value={end} onChange={e => setEnd(e.target.value)}/>
                <button className={styles.btn} type="button" onClick={() => { if (start < end && !slots.some(s => s.day === day && s.start === start && s.end === end)) setSlots([...slots,{day,start,end}]); }}>추가</button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8 }}>{slots.map((slot,index) => <span key={index} style={{ padding:'4px 8px', borderRadius:20, background:'#f8e7f0', color:'#482738' }}>{days[slot.day]} {slot.start}–{slot.end}<input type="hidden" name="slot" value={slot.day + '|' + slot.start + '|' + slot.end}/><button type="button" aria-label="시간 삭제" onClick={() => setSlots(slots.filter((_,i) => i !== index))} style={{ marginLeft:5, border:0, background:'transparent', cursor:'pointer' }}>×</button></span>)}</div>
            </div>
            <label style={fieldStyle}>메모<textarea className={styles.input} name="note" defaultValue={student.note ?? ''} style={{ minHeight:110, resize:'vertical' }}/></label>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div style={{ display:'flex', justifyContent:'flex-end' }}><button className={styles.btn} type="submit">변경 저장</button></div>
        </form>
      </section>
    </div>}
  </>;
}
