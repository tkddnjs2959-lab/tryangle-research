'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession, removeSession, moveSession, setScheduleClosure } from './actions';
import styles from '../../admin.module.css';

type Slot = { day: number; start: string; end: string };
type Student = { id: string; name: string; lesson_plan: string | null; homeroom_teacher: string | null; assistant_teacher: string | null; preferred_slots: Slot[] | null };
type Session = { id: string; lesson_date: string; start_time: string; end_time: string; teacher_name: string; student_id: string };
const teachers = ['이주아 T', '김유리 T'];
const colors: Record<string, string> = { '이주아 T': '#ec4899', '김유리 T': '#2563eb' };
const plans: Record<string, string> = { one_lead:'1:1 대표', one_team:'1:1 소속', pair_once:'2:1 주 1회', pair_twice:'2:1 주 2회' };
const addHour = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  if (hours >= 23) return '';
  return String(hours + 1).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
};
const localDate = (date: Date) => date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');

export default function ScheduleBoard({ month, sessions, students, closures }: { month: string; sessions: Session[]; students: Student[]; closures: { period_type: string; period_key: string }[] }) {
  const [query, setQuery] = useState('');
  const [closedPeriods, setClosedPeriods] = useState(closures);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [recentAssignment, setRecentAssignment] = useState<Session | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
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
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const displayedSessions = (recentAssignment && !sessions.some(item => item.id === recentAssignment.id) ? [...sessions, recentAssignment] : sessions).filter(item => !removedIds.includes(item.id));
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
  const teacherFor = (student: Student, day: string) => {
    if (student.lesson_plan === 'one_lead') return '이주아 T';
    if (student.lesson_plan === 'one_team') return '김유리 T';
    if (student.lesson_plan === 'pair_twice') {
      const monday = new Date(day + 'T12:00:00');
      monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
      const from = localDate(monday);
      monday.setDate(monday.getDate() + 7);
      const to = localDate(monday);
      const assigned = displayedSessions.filter(item => item.student_id === student.id && item.lesson_date >= from && item.lesson_date < to);
      return assigned.length === 0 ? student.homeroom_teacher : student.assistant_teacher;
    }
    return student.homeroom_teacher || '이주아 T';
  };
  const weekKey = localDate(startOfWeek);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const closingWeekEnd = new Date(startOfWeek);
  closingWeekEnd.setDate(closingWeekEnd.getDate() + 7);
  const weekIsPast = localDate(closingWeekEnd) <= today;
  const monthIsPast = month < today.slice(0, 7);
  const firstOfMonth = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), 1);
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setDate(1 - ((firstOfMonth.getDay() + 6) % 7));
  const weekNumber = Math.floor((startOfWeek.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
  const isLocked = (day: string) => {
    const target = new Date(day + 'T12:00:00');
    target.setDate(target.getDate() - (target.getDay() + 6) % 7);
    return closedPeriods.some(item => (item.period_type === 'month' && item.period_key === day.slice(0, 7)) || (item.period_type === 'week' && item.period_key === localDate(target)));
  };
  const selectedClosed = view === 'week' ? closedPeriods.some(item => item.period_type === 'week' && item.period_key === weekKey) : closedPeriods.some(item => item.period_type === 'month' && item.period_key === month);
  const toggleClosure = (type: 'week' | 'month', key: string, close: boolean) => {
    const form = new FormData();
    form.set('type', type); form.set('key', key); form.set('close', String(close));
    startTransition(async () => {
      try {
        const result = await setScheduleClosure(form);
        if (!result.ok) { setError(result.message); return; }
        setClosedPeriods(previous => close ? [...previous.filter(item => item.period_type !== type || item.period_key !== key), { period_type: type, period_key: key }] : previous.filter(item => item.period_type !== type || item.period_key !== key));
        setNotice(result.message); setError(''); router.refresh();
      } catch { setError('마감 상태를 변경하지 못했습니다.'); }
    });
  };
  const choose = (id: string, day: string) => {
    const student = names.get(id);
    if (!student) return;
    setSelected(id);
    setDate(day);
    setWeek(0);
    setTeacher(teacherFor(student, day) || '이주아 T');
  };
  const suggestions = current ? (current.preferred_slots ?? []).filter(slot => slot.day === new Date(date + 'T12:00:00').getDay()).map(slot => {
    const required = current.lesson_plan === 'one_lead' ? '이주아 T' : current.lesson_plan === 'one_team' ? '김유리 T' : null;
    const match = sessions.find(item => item.lesson_date === date && item.start_time.slice(0,5) >= slot.start && item.end_time.slice(0,5) <= slot.end && (!required || item.teacher_name === required) && current.lesson_plan?.startsWith('pair_') && names.get(item.student_id)?.lesson_plan?.startsWith('pair_') && sessions.filter(other => other.lesson_date === date && other.teacher_name === item.teacher_name && other.start_time === item.start_time && other.end_time === item.end_time).length < 2);
    return { slot, match };
  }) : [];
  const assign = (id: string, day: string) => {
    if (isLocked(day)) { setError('마감된 시간표는 수정할 수 없습니다.'); return; }
    const student = names.get(id);
    if (!student) return;
    choose(id, day);
    const preferred = (student.preferred_slots ?? []).filter(slot => slot.day === new Date(day + 'T12:00:00').getDay());
    if (!preferred.length) { setNotice('희망 시간이 없는 날짜입니다. 아래에서 시간을 선택해 배정하세요.'); return; }
    const required = student.lesson_plan === 'one_lead' ? '이주아 T' : student.lesson_plan === 'one_team' ? '김유리 T' : null;
    const candidates = preferred.flatMap(slot => sessions.filter(item => item.lesson_date === day && item.start_time.slice(0,5) >= slot.start && item.end_time.slice(0,5) <= slot.end && student.lesson_plan?.startsWith('pair_') && names.get(item.student_id)?.lesson_plan?.startsWith('pair_') && (!required || item.teacher_name === required) && sessions.filter(other => other.lesson_date === day && other.teacher_name === item.teacher_name && other.start_time === item.start_time && other.end_time === item.end_time).length === 1));
    const match = candidates[0];
    if (!match) {
      const slot = preferred[0];
      const teacherName = required || teacherFor(student, day) || '이주아 T';
      const startTime = slot.start;
      const suggestedEnd = addHour(slot.start);
      if (!suggestedEnd || suggestedEnd > slot.end || sessions.some(item => item.lesson_date === day && item.teacher_name === teacherName && item.start_time.slice(0,5) < suggestedEnd && item.end_time.slice(0,5) > startTime)) {
        setStart(slot.start); setEnd(slot.end);
        setNotice('희망 시간 ' + slot.start + '–' + slot.end + '입니다. 겹치는 수업이나 시간 범위를 확인한 뒤 아래에서 배정하세요.');
        return;
      }
      const form = new FormData();
      form.set('studentId', id); form.set('date', day); form.set('start', startTime); form.set('end', suggestedEnd); form.set('teacher', teacherName);
      setError(''); setNotice('');
      startTransition(async () => { try { const result = await saveSession(form); if (!result.ok) { setError(result.message); return; } router.refresh(); setNotice(startTime + ' 수업에 배정했습니다.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '배정하지 못했습니다.'); } });
      return;
    }
    const form = new FormData();
    form.set('studentId', id); form.set('date', day); form.set('start', match.start_time.slice(0,5)); form.set('end', match.end_time.slice(0,5)); form.set('teacher', match.teacher_name);
    setError(''); setNotice('');
    startTransition(async () => { try { const result = await saveSession(form); if (!result.ok) { setError(result.message); return; } router.refresh(); setNotice(match.start_time.slice(0,5) + ' 수업에 배정했습니다.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '배정하지 못했습니다.'); } });
  };
  const assignAt = (id: string, day: string, hour: string) => {
    if (isLocked(day)) { setError('마감된 시간표는 수정할 수 없습니다.'); return; }
    const student = names.get(id);
    if (!student) { setError('학생을 선택한 뒤 시간 칸에 놓아 주세요.'); return; }
    if (pending) return;
    setSelected(id);
    setDate(day);
    const endHour = addHour(hour);
    if (!endHour) { setError('해당 시간에는 1시간 수업을 배정할 수 없습니다.'); return; }
    const required = student.lesson_plan === 'one_lead' ? '이주아 T' : student.lesson_plan === 'one_team' ? '김유리 T' : null;
    const existingPair = sessions.find(item => item.lesson_date === day && item.start_time.slice(0,5) === hour && item.end_time.slice(0,5) === endHour && student.lesson_plan?.startsWith('pair_') && names.get(item.student_id)?.lesson_plan?.startsWith('pair_') && sessions.filter(other => other.lesson_date === day && other.teacher_name === item.teacher_name && other.start_time === item.start_time && other.end_time === item.end_time).length === 1);
    const teacherName = required || teacherFor(student, day) || existingPair?.teacher_name || '이주아 T';
    const form = new FormData();
    form.set('studentId', id); form.set('date', day); form.set('start', hour); form.set('end', endHour); form.set('teacher', teacherName);
    setStart(hour); setEnd(endHour); setTeacher(teacherName); setError(''); setNotice('');
    startTransition(async () => {
      try {
        const result = await saveSession(form);
        if (!result.ok) { setError(result.message); return; }
        setRecentAssignment({ id: result.id ?? 'new-' + Date.now(), lesson_date: day, start_time: hour, end_time: endHour, teacher_name: teacherName, student_id: id });
        router.refresh();
        setNotice(day + ' ' + hour + '에 ' + student.name + ' 학생을 배정했습니다.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '배정하지 못했습니다.');
      }
    });
  };
  const shiftMonth = (offset: number) => {
    const next = new Date(Number(month.slice(0,4)), Number(month.slice(5)) - 1 + offset, 1);
    router.push('/admin/operations/schedule?month=' + next.getFullYear() + '-' + String(next.getMonth()+1).padStart(2,'0'));
  };
  const grouped = new Map<string, Session[]>();
  for (const item of displayedSessions) {
    const key = [item.lesson_date, item.start_time, item.end_time, item.teacher_name].join('|');
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const lessons = [...grouped.entries()].map(([key, items]) => ({
    key,
    items: items.sort((a, b) => (names.get(a.student_id)?.name ?? '').localeCompare(names.get(b.student_id)?.name ?? '', 'ko') || a.student_id.localeCompare(b.student_id)),
    date: items[0].lesson_date,
    start: items[0].start_time.slice(0,5),
    end: items[0].end_time.slice(0,5),
    teacher: items[0].teacher_name,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || (names.get(a.items[0].student_id)?.name ?? '').localeCompare(names.get(b.items[0].student_id)?.name ?? '', 'ko') || a.teacher.localeCompare(b.teacher, 'ko'));
  const hourLabels = Array.from(new Set([
    ...Array.from({ length: 12 }, (_, index) => String(index + 10).padStart(2,'0') + ':00'),
    ...lessons.map(lesson => lesson.start),
  ])).sort();
  const moveLesson = (lesson: typeof lessons[number], day: string, hour: string) => {
    if (pending || (lesson.date === day && lesson.start === hour)) return;
    if (isLocked(lesson.date) || isLocked(day)) { setError('마감된 시간표는 수정할 수 없습니다.'); return; }
    const endHour = addHour(hour);
    if (!endHour) { setError('해당 시간에는 1시간 수업을 배정할 수 없습니다.'); return; }
    const item = lesson.items[0];
    const form = new FormData(); form.set('id', item.id); form.set('date', day); form.set('start', hour); form.set('end', endHour); form.set('teacher', lesson.teacher);
    setError(''); setNotice(''); setDropTarget(null); setDraggingId(null);
    startTransition(async () => { try { const result = await moveSession(form); if (!result.ok) { setError(result.message); return; } setRecentAssignment(null); setRemovedIds([]); router.refresh(); setNotice(day + ' ' + hour + '로 수업을 이동했습니다.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '수업을 이동하지 못했습니다.'); } });
  };
  const changeTeacher = (item: Session, teacherName: string) => {
    const form = new FormData();
    form.set('id', item.id);
    form.set('date', item.lesson_date);
    form.set('start', item.start_time.slice(0, 5));
    form.set('end', item.end_time.slice(0, 5));
    form.set('teacher', teacherName);
    startTransition(async () => {
      try {
        const result = await moveSession(form);
        if (!result.ok) { setError(result.message); return; }
        router.refresh();
        setNotice('담당 선생님을 변경했습니다.');
      } catch { setError('담당 선생님을 변경하지 못했습니다.'); }
    });
  };
  const lessonCard = (lesson: typeof lessons[number], compact: boolean) => {
    const first = names.get(lesson.items[0].student_id);
    const pair = first?.lesson_plan?.startsWith('pair_');
    const people = lesson.items.map(item => names.get(item.student_id)?.name ?? '학생');
    const label = pair ? (first?.lesson_plan === 'pair_twice' ? '2:1 주 2회' : '2:1 주 1회') : '1:1';
    return <div key={lesson.key} draggable={view === 'week' && lesson.items.length === 1 && !isLocked(lesson.date)} onDragStart={event => { if (view !== 'week' || lesson.items.length !== 1 || isLocked(lesson.date)) { event.preventDefault(); return; } setDraggingId(lesson.items[0].id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'session:' + lesson.items[0].id); }} onDragEnd={() => { setDraggingId(null); setDropTarget(null); }} style={{ cursor: view === 'week' ? 'grab' : undefined, borderLeft:'4px solid ' + (colors[lesson.teacher] ?? '#aaa'), background: lesson.teacher === '김유리 T' ? '#eff6ff' : '#fff1f7', color:'#241521', borderTop:'1px solid ' + (lesson.teacher === '김유리 T' ? '#bfdbfe' : '#f9cddd'), borderRight:'1px solid ' + (lesson.teacher === '김유리 T' ? '#bfdbfe' : '#f9cddd'), borderBottom:'1px solid ' + (lesson.teacher === '김유리 T' ? '#bfdbfe' : '#f9cddd'), boxShadow:'0 2px 8px rgba(58,19,43,.08)', borderRadius:9, padding:compact ? 6 : 10, marginTop:5, fontSize:compact ? 12 : 14 }}>
      <button type="button" onClick={() => setExpanded(expanded === lesson.key ? null : lesson.key)} aria-expanded={expanded === lesson.key} style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', color:'#241521', border:0, cursor:'pointer', padding:0, lineHeight:1.45 }}>
        <strong style={{ display:'block', color:'#3a1730', overflowWrap:'anywhere', whiteSpace:'normal' }} title={people.join(' · ')}>{people.join(' · ')}{pair && people.length === 1 ? ' · 빈자리 1' : ''}</strong>
        <small style={{ display:'block', color:'#80576e', fontWeight:700, marginTop:3 }}>{label} · {lesson.teacher}</small>
      </button>
      {expanded === lesson.key && <div style={{ paddingTop:8, color:'#372332', borderTop:'1px solid #efd8e6', marginTop:8 }}>
        {lesson.items.map(item => <div key={item.id} draggable={!isLocked(item.lesson_date)} onDragStart={event => { event.stopPropagation(); if (isLocked(item.lesson_date)) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'session:' + item.id); }}>
          {names.get(item.student_id)?.name ?? '학생'} · {plans[names.get(item.student_id)?.lesson_plan ?? ''] ?? '상품 미정'}
          <label> 담당 <select aria-label="회차 담당 선생님" defaultValue={item.teacher_name} disabled={pending || isLocked(item.lesson_date)} onChange={event => changeTeacher(item, event.target.value)}>{teachers.map(name => <option key={name} value={name}>{name === names.get(item.student_id)?.homeroom_teacher ? '담임 · ' : name === names.get(item.student_id)?.assistant_teacher ? '부담임 · ' : ''}{name}</option>)}</select></label>
          <form action={async form => { try { await removeSession(form); setRecentAssignment(previous => previous?.id === item.id ? null : previous); setRemovedIds(previous => [...previous, item.id]); router.refresh(); setNotice('배정을 취소했습니다.'); } catch { setError('배정 취소에 실패했습니다. 다시 시도해 주세요.'); } }}><input type="hidden" name="id" value={item.id}/><button type="submit" disabled={pending || isLocked(item.lesson_date)}>배정 취소</button></form>
        </div>)}
      </div>}
    </div>;
  };
  const weekEnd = new Date(startOfWeek); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = displayedSessions.filter(item => item.lesson_date >= localDate(startOfWeek) && item.lesson_date < localDate(weekEnd));
  const lessonCount = (items: Session[]) => new Set(items.map(item => [item.lesson_date,item.start_time,item.end_time,item.teacher_name].join('|'))).size;
  const downloadWeek = () => {
    const canvas = document.createElement('canvas');
    const width = 1680;
    const left = 96;
    const column = (width - left) / 7;
    const rowHeight = 112;
    const top = 180;
    canvas.width = width;
    canvas.height = top + hourLabels.length * rowHeight + 48;
    const context = canvas.getContext('2d');
    if (!context) { setError('이미지를 만들지 못했습니다.'); return; }
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#2d1727';
    context.font = 'bold 30px sans-serif';
    context.fillText('주간 수업 시간표', 32, 46);
    context.font = '20px sans-serif';
    context.fillText(days[0] + ' ~ ' + days[6], 32, 80);
    context.fillText('수업 ' + lessonCount(weekSessions) + '타임 · 전체 학생 ' + new Set(weekSessions.map(item => item.student_id)).size + '명', 32, 112);
    teachers.forEach((name, index) => {
      context.fillStyle = colors[name];
      context.fillRect(34 + index * 290, 130, 16, 16);
      context.fillStyle = '#2d1727';
      context.fillText(name, 60 + index * 290, 145);
    });
    context.strokeStyle = '#ddd2d9';
    context.lineWidth = 1;
    days.forEach((day, index) => {
      const x = left + index * column;
      context.fillStyle = '#fdf0f7';
      context.fillRect(x, top - 38, column, 38);
      context.fillStyle = '#342130';
      context.font = 'bold 17px sans-serif';
      context.fillText(day.slice(5) + ' (' + '일월화수목금토'[new Date(day + 'T12:00:00').getDay()] + ')', x + 10, top - 12);
      context.strokeRect(x, top - 38, column, 38);
      hourLabels.forEach((hour, row) => {
        const y = top + row * rowHeight;
        context.strokeRect(x, y, column, rowHeight);
        const items = lessons.filter(lesson => lesson.date === day && lesson.start === hour);
        items.forEach((lesson, itemIndex) => {
          const cardY = y + 7 + itemIndex * 48;
          context.fillStyle = colors[lesson.teacher] ?? '#777';
          context.fillRect(x + 7, cardY, 5, 42);
          context.fillStyle = '#32202d';
          context.font = 'bold 16px sans-serif';
          const namesText = lesson.items.map(item => names.get(item.student_id)?.name ?? '학생').join(' · ');
          context.fillText(namesText.slice(0, 14), x + 18, cardY + 18);
          context.font = '14px sans-serif';
          context.fillText((plans[names.get(lesson.items[0].student_id)?.lesson_plan ?? ''] ?? '1:1') + ' · ' + lesson.teacher, x + 18, cardY + 37);
        });
      });
    });
    hourLabels.forEach((hour, row) => {
      const y = top + row * rowHeight;
      context.fillStyle = '#422a3a';
      context.font = 'bold 18px sans-serif';
      context.fillText(hour, 13, y + 30);
      context.strokeRect(0, y, left, rowHeight);
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = '주간시간표_' + days[0] + '_' + days[6] + '.png';
    link.click();
  };
  const periodSessions = displayedSessions.filter(item => view === 'week'
    ? item.lesson_date >= days[0] && item.lesson_date <= days[6]
    : item.lesson_date.startsWith(month));
  const periodAssignedIds = new Set(periodSessions.map(item => item.student_id));
  const visibleStudents = students.filter(student => student.name.includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id));
  const unassignedStudents = visibleStudents.filter(student => !periodAssignedIds.has(student.id));
  const assignedStudents = visibleStudents.filter(student => periodAssignedIds.has(student.id));
  const studentButton = (student: Student) => <button key={student.id} type="button" draggable={!isLocked(date)}
    onDragStart={event => { if (isLocked(date)) { event.preventDefault(); return; } setDraggingId(student.id); event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain',student.id); }}
    onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
    onClick={() => choose(student.id,date)} className={styles.btn}>
    {student.name} · {plans[student.lesson_plan ?? ''] ?? '상품 미정'} · {periodSessions.filter(item => item.student_id === student.id).length}타임
  </button>;
  return <section className={styles.block}>
    <div className={styles.summary}>
      <strong>이번 주 총 수업 {lessonCount(weekSessions)}타임 · 전체 학생 {new Set(weekSessions.map(item => item.student_id)).size}명</strong>
      {teachers.map(name => { const items = weekSessions.filter(item => item.teacher_name === name); return <span key={name} style={{borderLeft:'4px solid ' + colors[name], padding:'6px 10px', background:'#fff'}}>{name} · 수업 {lessonCount(items)}타임</span>; })}
    </div>
    <div className={styles.summary}>
      <button type="button" className={styles.btn} onClick={() => shiftMonth(-1)}>← 이전 달</button><strong>{month}</strong><button type="button" className={styles.btn} onClick={() => shiftMonth(1)}>다음 달 →</button>
      <button type="button" className={styles.btn} onClick={() => setView('week')}>주간</button>
      <button type="button" className={styles.btn} onClick={() => setView('month')}>월간</button>
      {view === 'week' && <><button type="button" className={styles.btn} onClick={downloadWeek}>주간 시간표 다운로드</button><button type="button" className={styles.btn} onClick={() => setWeek(value => value - 1)}>이전 주</button><button type="button" className={styles.btn} onClick={() => setWeek(value => value + 1)}>다음 주</button></>}
    </div>
    {(view === 'week' ? weekIsPast : monthIsPast) && <button type="button" className={styles.btn} disabled={pending} onClick={() => toggleClosure(view, view === 'week' ? weekKey : month, !selectedClosed)}>{selectedClosed ? '마감 해제' : (view === 'week' ? '이 주차 마감' : '이 달 마감')}</button>}
    {view === 'week' ? <div style={{ overflowX:'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:'68px repeat(7,minmax(145px,1fr))', minWidth:1100, border:'1px solid #e8dfe5', borderRadius:12, overflow:'hidden', background:'#fff' }}>
        <div style={{ gridColumn:'1 / -1', padding:'12px 16px', background:'#fff0f7', color:'#3a1730', fontSize:19, fontWeight:800 }}>{startOfWeek.getMonth() + 1}월 {weekNumber}주차 · {days[0].slice(5)}~{days[6].slice(5)} {days.every(isLocked) ? '· 마감' : ''}</div>
        <div style={{ padding:12, background:'#fcf5f9', color:'#513446', fontWeight:700, borderRight:'1px solid #e8dfe5' }}>시간</div>
        {days.map(day => <button type="button" key={day} onClick={() => setDate(day)} style={{ background:date === day ? '#fce6f1' : '#fcf5f9', color:'#3a1730', fontWeight:700, border:'none', borderLeft:'1px solid #e8dfe5', padding:12, cursor:'pointer' }}>
          {day.slice(5)} ({'일월화수목금토'[new Date(day + 'T12:00:00').getDay()]})
        </button>)}
        {hourLabels.map(hour => <div key={hour} style={{ display:'contents' }}>
          <div style={{ padding:12, color:'#62495a', fontWeight:700, borderTop:'1px solid #e8dfe5', borderRight:'1px solid #e8dfe5', background:'#fffafd' }}>{hour}</div>
          {days.map(day => <div key={day} onDragEnter={() => setDropTarget(day + hour)} onDragLeave={() => setDropTarget(null)} onDragOver={event => { if (isLocked(day)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); event.stopPropagation(); const payload = event.dataTransfer.getData('text/plain'); setDropTarget(null); if (payload.startsWith('session:')) { const id = payload.slice(8); const lesson = lessons.find(item => item.items.some(session => session.id === id)); if (lesson) moveLesson({ ...lesson, items: lesson.items.filter(session => session.id === id) },day,hour); } else { setDraggingId(null); assignAt(payload || draggingId || '',day,hour); } }} style={{ minHeight:100, minWidth:0, borderTop:'1px solid #e8dfe5', borderLeft:'1px solid #e8dfe5', padding:7, background:isLocked(day) ? '#f3f1f3' : dropTarget === day + hour ? '#f9d3e8' : date === day ? '#fff4fa' : '#fff' }}>
            {lessons.filter(lesson => lesson.date === day && lesson.start === hour).map(lesson => lessonCard(lesson,false))}
          </div>)}
        </div>)}
      </div>
    </div> : <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:5, background:'#fff', borderRadius:12, padding:6 }}>
      <div style={{ gridColumn:'1 / -1', color:'#3a1730', fontSize:19, fontWeight:800, padding:'10px 8px' }}>{Number(month.slice(5))}월 월간 시간표 {selectedClosed ? '· 마감' : ''}</div>
      {['월','화','수','목','금','토','일'].map(label => <strong key={label} style={{ textAlign:'center', color:'#513446', padding:7 }}>{label}</strong>)}
      {Array.from({ length:(new Date(month + '-01T12:00:00').getDay()+6)%7 }, (_,index) => <div key={'blank-'+index}/>)}
      {days.map(day => <div key={day} onDragOver={event => { if (!isLocked(day)) event.preventDefault(); }} onDrop={event => { event.preventDefault(); assign(event.dataTransfer.getData('text/plain'),day); }} style={{ minHeight:110, minWidth:0, border:'1px solid #eadce5', borderRadius:8, padding:6, background:isLocked(day) ? '#f3f1f3' : date === day ? '#fff0f8' : '#fff' }}>
        <button type="button" onClick={() => setDate(day)} style={{ background:'transparent', border:0, color:'#3a1730', fontWeight:700, cursor:'pointer' }}>{Number(day.slice(-2))} ({'일월화수목금토'[new Date(day + 'T12:00:00').getDay()]})</button>
        {lessons.filter(lesson => lesson.date === day).sort((a,b) => a.start.localeCompare(b.start)).map(lesson => lessonCard(lesson,true))}
      </div>)}
    </div>}
    <h2>학생 검색·배정</h2>
    <input className={styles.input} aria-label="학생 검색" placeholder="학생 이름 검색" value={query} onChange={event => setQuery(event.target.value)}/>
    <h3>{view === 'week' ? '이번 주' : '이번 달'} 미배정 학생 {unassignedStudents.length}명</h3>
    <div className={styles.summary}>{unassignedStudents.map(studentButton)}</div>
    <h3>{view === 'week' ? '이번 주' : '이번 달'} 배정 학생 {assignedStudents.length}명</h3>
    <div className={styles.summary}>{assignedStudents.map(studentButton)}</div>
    <p>주간 시간 칸에 학생을 놓으면 해당 시간에 바로 배정됩니다. 분홍색 칸 위에 놓아 주세요. 월간 날짜 칸에서는 희망 시간에 배정합니다.</p>
    {current && <div><h3>{current.name} · {plans[current.lesson_plan ?? ''] ?? '상품 미정'} · 담임 {current.homeroom_teacher ?? '미배정'} · 부담임 {current.assistant_teacher ?? '미배정'}</h3>
      {suggestions.length ? suggestions.map(({slot,match},index) => <button type="button" key={index} className={styles.btn} onClick={() => { setStart(match?.start_time.slice(0,5) ?? slot.start); setEnd(match?.end_time.slice(0,5) ?? slot.end); setTeacher(match?.teacher_name ?? teacherFor(current, date) ?? '이주아 T'); }}>{match ? '빈자리 추천' : '희망 시간'} · {slot.start}–{slot.end} {match ? '· ' + match.teacher_name : ''}</button>) : <p>선택한 날짜에 등록된 희망 시간이 없습니다. 직접 시간을 지정할 수 있습니다.</p>}
    </div>}
    <details open={view === 'month'}><summary>직접 배정</summary><form action={async form => { try { const result = await saveSession(form); if (!result.ok) { setError(result.message); return; } router.refresh(); setError(''); setNotice('시간표에 배정했습니다.'); } catch (cause) { setError(cause instanceof Error ? cause.message : '배정하지 못했습니다.'); } }} className={styles.searchForm}>
      <input type="hidden" name="studentId" value={selected}/>
      <label>날짜 <input type="date" name="date" required value={date} onChange={event => { setDate(event.target.value); setWeek(0); }}/></label>
      <label>시작 <input type="time" name="start" required value={start} onChange={event => setStart(event.target.value)}/></label>
      <label>종료 <input type="time" name="end" required value={end} onChange={event => setEnd(event.target.value)}/></label>
      <label>수업 선생님 <select name="teacher" value={teacher} onChange={event => setTeacher(event.target.value)}>{teachers.map(name => <option key={name}>{name}</option>)}</select></label>
      <button type="submit" className={styles.btn} disabled={!selected || isLocked(date) || pending}>시간표에 배정</button>
    </form></details>
    {notice && <p role="status">{notice}</p>}
    {pending && <p role="status">배정 중…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
