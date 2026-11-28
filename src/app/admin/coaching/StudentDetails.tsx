'use client';
import { useState } from 'react';
import { saveStudentPreferences } from './preferences-actions';
import { saveConsultation } from '../calendar/actions';
import TuitionInput from './TuitionInput';
import type { CoachingStudentRow } from '@/lib/admin-data';
import styles from '../admin.module.css';

const plans = { one_lead: '1:1 대표', one_team: '1:1 소속', pair_once: '2:1 주 1회', pair_twice: '2:1 주 2회' };
const consultationStatus: Record<string,string> = { planned:'예정', done:'완료', canceled:'취소' };
const fieldStyle = { display:'grid', gap:5, fontSize:12, fontWeight:700, color:'#5b3b4d' } as const;

type Consultation = { id: string; consultation_date: string; consultation_time: string | null; status: string; teacher: string | null; note: string | null; follow_up_date: string | null; next_action: string | null };
export default function StudentDetails({ student, consultations = [] }: { student: CoachingStudentRow; consultations?: Consultation[] }) {
  const [open, setOpen] = useState(false);
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
          <div><h2 style={{ margin:0, fontSize:22 }}>{student.name} 학생 정보</h2><small style={{ color:'#765d6c' }}>기본 정보, 수강 조건, 상담 기록을 한곳에서 확인합니다.</small></div>
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
            <label style={fieldStyle}>부담임 선생님<select className={styles.input} name="assistantTeacher" defaultValue={student.assistantTeacher ?? ''}><option value="">미배정</option><option>이주아 T</option><option>김유리 T</option></select></label>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
            <label style={fieldStyle}>첫 시작일 (직접 입력 시 우선 적용)<input className={styles.input} name="firstStartDate" type="date" defaultValue={student.firstStartDate ?? ''}/></label>
            <label style={fieldStyle}>학생 메모<textarea className={styles.input} name="note" defaultValue={student.note ?? ''} style={{ minHeight:80, resize:'vertical' }}/></label>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div style={{ display:'flex', justifyContent:'flex-end' }}><button className={styles.btn} type="submit">변경 저장</button></div>
        </form>
        <section style={{ marginTop:20, borderTop:'1px solid #f0e3eb', paddingTop:14 }}>
          <h3 style={{ margin:'0 0 10px' }}>상담 기록</h3>
          <form action={async form => { try { await saveConsultation(form); setError(''); } catch (err) { setError(err instanceof Error ? err.message : '상담을 저장하지 못했습니다.'); } }} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))', gap:8 }}>
            <input type="hidden" name="studentId" value={student.id}/>
            <label style={fieldStyle}>상담 예정일<input className={styles.input} name="date" type="date" required/></label>
            <label style={fieldStyle}>시간<input className={styles.input} name="time" type="time"/></label>
            <label style={fieldStyle}>상담 담당<select className={styles.input} name="teacher"><option value="">미정</option><option>이주아 T</option><option>김유리 T</option></select></label>
            <label style={fieldStyle}>상태<select className={styles.input} name="status"><option value="planned">예정</option><option value="done">완료</option><option value="canceled">취소</option></select></label>
            <label style={fieldStyle}>다음 연락일<input className={styles.input} name="followUpDate" type="date"/></label>
            <label style={{ ...fieldStyle, gridColumn:'1 / -1' }}>상담 내용<textarea className={styles.input} name="note" maxLength={3000}/></label>
            <label style={{ ...fieldStyle, gridColumn:'1 / -1' }}>후속 조치<input className={styles.input} name="nextAction" maxLength={500}/></label>
            <button className={styles.btn} type="submit">상담 기록 추가</button>
          </form>
          <div style={{ display:'grid', gap:7, marginTop:12 }}>
            {consultations.length === 0 && <p>상담 기록이 없습니다.</p>}
            {consultations.map(c => <div key={c.id} style={{ border:'1px solid #f0e3eb', borderRadius:9, padding:10 }}>
              <strong>{c.consultation_date} {c.consultation_time?.slice(0,5) ?? ''} · {consultationStatus[c.status] ?? c.status}</strong> {c.teacher ?? ''}
              {c.note && <p style={{ whiteSpace:'pre-wrap', margin:'6px 0' }}>{c.note}</p>}
              {c.next_action && <small>다음 조치: {c.next_action}{c.follow_up_date ? ' (' + c.follow_up_date + ')' : ''}</small>}
              <form action={saveConsultation} style={{ marginTop:7, display:'flex', gap:5 }}>
                <input type="hidden" name="id" value={c.id}/><input type="hidden" name="studentId" value={student.id}/>
                <input type="hidden" name="date" value={c.consultation_date}/><input type="hidden" name="time" value={c.consultation_time?.slice(0,5) ?? ''}/>
                <input type="hidden" name="teacher" value={c.teacher ?? ''}/><input type="hidden" name="note" value={c.note ?? ''}/>
                <input type="hidden" name="followUpDate" value={c.follow_up_date ?? ''}/><input type="hidden" name="nextAction" value={c.next_action ?? ''}/>
                <select className={styles.input} name="status" defaultValue={c.status} aria-label="상담 상태"><option value="planned">예정</option><option value="done">완료</option><option value="canceled">취소</option></select><button className={styles.btn}>상태 저장</button>
              </form>
            </div>)}
          </div>
        </section>
      </section>
    </div>}
  </>;
}
