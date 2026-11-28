'use server';
import { revalidatePath } from 'next/cache';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';

const uuid = /^[0-9a-f-]{36}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => datePattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

export async function saveConsultation(form: FormData) {
  if (!(await currentAdminIdentity())) throw new Error('로그인이 필요합니다.');
  const id = String(form.get('id') ?? '');
  let studentId = String(form.get('studentId') ?? '');
  const date = String(form.get('date') ?? '');
  const time = String(form.get('time') ?? '');
  const status = String(form.get('status') ?? 'planned');
  const teacher = String(form.get('teacher') ?? '');
  const note = String(form.get('note') ?? '').trim();
  const followUpDate = String(form.get('followUpDate') ?? '');
  const nextAction = String(form.get('nextAction') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const contact = String(form.get('contact') ?? '').trim();
  if (id && !uuid.test(id)) throw new Error('상담 기록을 확인해 주세요.');
  if (studentId && !uuid.test(studentId)) throw new Error('학생을 확인해 주세요.');
  if (!validDate(date) || (followUpDate && !validDate(followUpDate)) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('상담 날짜와 시간을 확인해 주세요.');
  if (!['planned','done','canceled'].includes(status) || (teacher && !['이주아 T','김유리 T'].includes(teacher)) || note.length > 3000 || nextAction.length > 500 || name.length > 120 || contact.length > 120) throw new Error('상담 정보를 확인해 주세요.');
  if (!studentId && (!name || id)) throw new Error('학생을 선택하거나 새 상담자 이름을 입력해 주세요.');
  const client = db();
  let createdId: string | null = null;
  if (!studentId) {
    const created = await client.from('coaching_students').insert({ name, contact: contact || null, gender: 'female', status: 'unregistered' }).select('id').single();
    if (created.error || !created.data) throw new Error('상담자를 등록하지 못했습니다.');
    studentId = created.data.id;
    createdId = studentId;
  }
  const payload = { student_id: studentId, consultation_date: date, consultation_time: time || null, status, teacher: teacher || null, note: note || null, follow_up_date: followUpDate || null, next_action: nextAction || null };
  const result = id
    ? await client.from('coaching_consultations').update(payload).eq('id', id).eq('student_id', studentId).select('id').single()
    : await client.from('coaching_consultations').insert(payload).select('id').single();
  if (result.error || !result.data) {
    if (createdId) await client.from('coaching_students').delete().eq('id', createdId);
    throw new Error('상담 기록을 저장하지 못했습니다.');
  }
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/coaching');
}
