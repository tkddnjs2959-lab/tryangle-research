'use server';
import { revalidatePath } from 'next/cache';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';

const path = '/admin/operations/schedule';

export async function saveSession(form: FormData) {
  if (!(await currentAdminIdentity())) throw new Error('로그인이 필요합니다.');
  const date = String(form.get('date') ?? '');
  const start = String(form.get('start') ?? '');
  const end = String(form.get('end') ?? '');
  const teacher = String(form.get('teacher') ?? '').trim();
  const studentId = String(form.get('studentId') ?? '');
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end || !['이주아 T','김유리 T'].includes(teacher) || !/^[0-9a-f-]{36}$/i.test(studentId)) throw new Error('수업 정보를 확인해 주세요.');
  const student = await db().from('coaching_students').select('id, lesson_plan').eq('id', studentId).neq('status', 'archived').single();
  if (student.error) throw new Error('학생을 찾을 수 없습니다.');
  if ((student.data.lesson_plan === 'one_lead' && teacher !== '이주아 T') || (student.data.lesson_plan === 'one_team' && teacher !== '김유리 T')) throw new Error('1:1 수업의 선택 선생님과 배정 선생님이 다릅니다.');
  const existing = await db().from('lesson_sessions').select('student_id, start_time, end_time, teacher_name').eq('lesson_date', date).lt('start_time', end).gt('end_time', start);
  if (existing.error) throw new Error('기존 수업을 조회하지 못했습니다.');
  if (existing.data.some(item => item.student_id === studentId)) throw new Error('학생에게 겹치는 수업이 있습니다.');
  const sameTeacher = existing.data.filter(item => item.teacher_name === teacher);
  if (sameTeacher.some(item => item.start_time !== start || item.end_time !== end) || sameTeacher.length >= 2) throw new Error('선생님 시간 또는 2:1 정원을 확인해 주세요.');
  if (sameTeacher.length) {
    const partners = await db().from('coaching_students').select('id, lesson_plan').in('id', sameTeacher.map(item => item.student_id));
    if (partners.error || !student.data.lesson_plan?.startsWith('pair_') || partners.data.some(item => !item.lesson_plan?.startsWith('pair_'))) throw new Error('2:1 수업 학생끼리만 함께 배정할 수 있습니다.');
  }
  const result = await db().from('lesson_sessions').insert({ lesson_date: date, start_time: start, end_time: end, teacher_name: teacher, student_id: studentId });
  if (result.error) throw new Error('배정을 저장하지 못했습니다. 같은 시간의 중복 배정을 확인해 주세요.');
  revalidatePath(path);
}

export async function removeSession(form: FormData) {
  if (!(await currentAdminIdentity())) throw new Error('로그인이 필요합니다.');
  const id = String(form.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('회차를 확인해 주세요.');
  const result = await db().from('lesson_sessions').delete().eq('id', id);
  if (result.error) throw new Error('배정을 취소하지 못했습니다.');
  revalidatePath(path);
}
