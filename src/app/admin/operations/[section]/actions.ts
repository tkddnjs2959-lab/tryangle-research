'use server';
import { revalidatePath } from 'next/cache';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';

const path = '/admin/operations/schedule';

export async function saveSession(form: FormData): Promise<{ ok: boolean; message: string; id?: string }> {
  if (!(await currentAdminIdentity())) return { ok: false, message: '로그인이 필요합니다. 다시 로그인해 주세요.' };
  const date = String(form.get('date') ?? '');
  const start = String(form.get('start') ?? '');
  const end = String(form.get('end') ?? '');
  const teacher = String(form.get('teacher') ?? '').trim();
  const studentId = String(form.get('studentId') ?? '');
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end || !['이주아 T','김유리 T'].includes(teacher) || !/^[0-9a-f-]{36}$/i.test(studentId)) {
    return { ok: false, message: '학생, 날짜, 시간을 확인해 주세요.' };
  }
  const student = await db().from('coaching_students').select('id, lesson_plan, homeroom_teacher, assistant_teacher').eq('id', studentId).neq('status', 'archived').single();
  if (student.error) return { ok: false, message: '학생 정보를 찾을 수 없습니다.' };
  if ((student.data.lesson_plan === 'one_lead' && teacher !== '이주아 T') || (student.data.lesson_plan === 'one_team' && teacher !== '김유리 T')) {
    return { ok: false, message: '이 학생의 1:1 수업 선생님을 확인해 주세요.' };
  }

  if (student.data.lesson_plan === 'pair_twice') {
    const lead = student.data.homeroom_teacher;
    const assistant = student.data.assistant_teacher;
    if (!lead || !assistant || lead === assistant || ![lead, assistant].includes(teacher)) return { ok: false, message: '담임과 부담임을 학생 정보에서 먼저 지정해 주세요.' };
    const monday = new Date(date + 'T12:00:00');
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const weekStart = monday.toISOString().slice(0, 10);
    monday.setDate(monday.getDate() + 7);
    const weekEnd = monday.toISOString().slice(0, 10);
    const assigned = await db().from('lesson_sessions').select('id, teacher_name').eq('student_id', studentId).gte('lesson_date', weekStart).lt('lesson_date', weekEnd);
    if (assigned.error) return { ok: false, message: '이번 주 배정을 확인하지 못했습니다.' };
    if (assigned.data.some(item => item.teacher_name === teacher) || assigned.data.length >= 2) return { ok: false, message: '이번 주에는 담임과 부담임이 각각 한 번씩 수업합니다.' };
  }
  const existing = await db().from('lesson_sessions').select('student_id, start_time, end_time, teacher_name').eq('lesson_date', date).lt('start_time', end).gt('end_time', start);
  if (existing.error) return { ok: false, message: '기존 시간표를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  if (existing.data.some(item => item.student_id === studentId)) return { ok: false, message: '이 학생에게 같은 시간의 수업이 이미 있습니다.' };
  const sameTeacher = existing.data.filter(item => item.teacher_name === teacher);
  if (sameTeacher.some(item => item.start_time.slice(0,5) !== start || item.end_time.slice(0,5) !== end) || sameTeacher.length >= 2) {
    return { ok: false, message: '이 시간에 선생님의 수업이 이미 배정되어 있습니다.' };
  }
  if (sameTeacher.length) {
    const partners = await db().from('coaching_students').select('id, lesson_plan').in('id', sameTeacher.map(item => item.student_id));
    if (partners.error) return { ok: false, message: '기존 수업 정보를 확인하지 못했습니다.' };
    if (!student.data.lesson_plan?.startsWith('pair_') || partners.data.some(item => !item.lesson_plan?.startsWith('pair_'))) {
      return { ok: false, message: '2:1 수업의 빈자리에는 2:1 학생만 배정할 수 있습니다.' };
    }
  }
  const result = await db().from('lesson_sessions').insert({ lesson_date: date, start_time: start, end_time: end, teacher_name: teacher, student_id: studentId }).select('id').single();
  if (result.error) return { ok: false, message: result.error.code === '23505' ? '이미 배정된 수업입니다.' : '배정을 저장하지 못했습니다. 다시 시도해 주세요.' };
  revalidatePath(path);
  return { ok: true, message: '배정했습니다.', id: result.data.id };
}

export async function removeSession(form: FormData) {
  if (!(await currentAdminIdentity())) throw new Error('로그인이 필요합니다.');
  const id = String(form.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('회차를 확인해 주세요.');
  const result = await db().from('lesson_sessions').delete().eq('id', id);
  if (result.error) throw new Error('배정을 취소하지 못했습니다.');
  revalidatePath(path);
}

export async function moveSession(form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!(await currentAdminIdentity())) return { ok: false, message: '로그인이 필요합니다. 다시 로그인해 주세요.' };
  const id = String(form.get('id') ?? '');
  const date = String(form.get('date') ?? '');
  const start = String(form.get('start') ?? '');
  const end = String(form.get('end') ?? '');
  const teacher = String(form.get('teacher') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end || !['이주아 T','김유리 T'].includes(teacher)) return { ok: false, message: '학생, 날짜, 시간을 확인해 주세요.' };
  const dbClient = db();
  const session = await dbClient.from('lesson_sessions').select('id, student_id').eq('id', id).single();
  if (session.error) return { ok: false, message: '이동할 수업을 찾을 수 없습니다.' };
  const student = await dbClient.from('coaching_students').select('lesson_plan, homeroom_teacher, assistant_teacher').eq('id', session.data.student_id).single();
  if (student.error) return { ok: false, message: '학생 정보를 찾을 수 없습니다.' };
  if ((student.data.lesson_plan === 'one_lead' && teacher !== '이주아 T') || (student.data.lesson_plan === 'one_team' && teacher !== '김유리 T')) return { ok: false, message: '이 학생의 1:1 담당 선생님과 일치하지 않습니다.' };

  if (student.data.lesson_plan === 'pair_twice') {
    const lead = student.data.homeroom_teacher;
    const assistant = student.data.assistant_teacher;
    if (!lead || !assistant || lead === assistant || ![lead, assistant].includes(teacher)) return { ok: false, message: '담임과 부담임 설정을 확인해 주세요.' };
    const monday = new Date(date + 'T12:00:00');
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const weekStart = monday.toISOString().slice(0, 10);
    monday.setDate(monday.getDate() + 7);
    const assigned = await dbClient.from('lesson_sessions').select('id, teacher_name').eq('student_id', session.data.student_id).neq('id', id).gte('lesson_date', weekStart).lt('lesson_date', monday.toISOString().slice(0, 10));
    if (assigned.error) return { ok: false, message: '이번 주 배정을 확인하지 못했습니다.' };
    if (assigned.data.length >= 2 || assigned.data.some(item => item.teacher_name === teacher)) return { ok: false, message: '이번 주에는 담임과 부담임이 각각 한 번씩 수업합니다.' };
  }
  const conflicts = await dbClient.from('lesson_sessions').select('id, student_id, start_time, end_time, teacher_name').eq('lesson_date', date).neq('id', id).lt('start_time', end).gt('end_time', start);
  if (conflicts.error) return { ok: false, message: '해당 시간의 기존 수업을 확인하지 못했습니다.' };
  if (conflicts.data.some(row => row.student_id === session.data.student_id)) return { ok: false, message: '학생에게 같은 시간의 수업이 이미 있습니다.' };
  const sameTeacher = conflicts.data.filter(row => row.teacher_name === teacher);
  if (sameTeacher.some(row => row.start_time.slice(0,5) !== start || row.end_time.slice(0,5) !== end) || sameTeacher.length >= 2) return { ok: false, message: '해당 시간에 선생님의 수업이 이미 배정되어 있습니다.' };
  if (sameTeacher.length) {
    const partners = await dbClient.from('coaching_students').select('id, lesson_plan').in('id', sameTeacher.map(row => row.student_id));
    if (partners.error || !student.data.lesson_plan?.startsWith('pair_') || partners.data.some(row => !row.lesson_plan?.startsWith('pair_'))) return { ok: false, message: '2:1 수업 빈자리에만 함께 배정할 수 있습니다.' };
  }
  const moved = await dbClient.from('lesson_sessions').update({ lesson_date: date, start_time: start, end_time: end, teacher_name: teacher }).eq('id', id);
  if (moved.error) return { ok: false, message: moved.error.code === '23505' ? '이미 배정된 시간입니다.' : '수업 이동을 저장하지 못했습니다.' };
  revalidatePath(path);
  return { ok: true, message: '수업을 이동했습니다.' };
}
