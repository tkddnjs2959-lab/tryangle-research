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
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end || !teacher || teacher.length > 100 || !/^[0-9a-f-]{36}$/i.test(studentId)) throw new Error('수업 정보를 확인해 주세요.');
  const student = await db().from('coaching_students').select('id').eq('id', studentId).neq('status', 'archived').single();
  if (student.error) throw new Error('학생을 찾을 수 없습니다.');
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
