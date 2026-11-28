'use server';
import { revalidatePath } from 'next/cache';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';

export async function saveStudentPreferences(form: FormData) {
  if (!(await currentAdminIdentity())) throw new Error('로그인이 필요합니다.');
  const id = String(form.get('id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const contact = String(form.get('contact') ?? '').trim();
  const residence = String(form.get('residence') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  const plan = String(form.get('lessonPlan') ?? '');
  const teacher = String(form.get('homeroomTeacher') ?? '');
  const tuitionRaw = String(form.get('monthlyTuition') ?? '').trim();
  const monthlyTuition = tuitionRaw ? Number(tuitionRaw) : null;
  if (monthlyTuition !== null && (!Number.isSafeInteger(monthlyTuition) || monthlyTuition < 0 || monthlyTuition > 100000000)) throw new Error('수강 금액을 확인해 주세요.');
  const birth = String(form.get('birthYear') ?? '').trim();
  const birthYear = birth ? Number(birth) : null;
  const gender = String(form.get('gender') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > 120 || contact.length > 120 || residence.length > 120 || note.length > 2000 || !['female','male'].includes(gender) || (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > 2100)) || (plan && !['one_lead','one_team','pair_once','pair_twice'].includes(plan)) || (teacher && !['이주아 T','김유리 T'].includes(teacher))) throw new Error('학생 정보를 확인해 주세요.');
  const slots = form.getAll('slot').map(value => {
    const [day, start, end] = String(value).split('|');
    return { day: Number(day), start, end };
  });
  if (slots.some(slot => !Number.isInteger(slot.day) || slot.day < 0 || slot.day > 6 || !/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end) || slot.start >= slot.end)) throw new Error('희망 시간을 확인해 주세요.');
  const result = await db().from('coaching_students').update({
    name, contact: contact || null, residence: residence || null, note: note || null,
    birth_year: birthYear, gender, lesson_plan: plan || null,
    homeroom_teacher: teacher || null, preferred_slots: slots, monthly_tuition: monthlyTuition,
  }).eq('id', id).neq('status','archived').select('id').single();
  if (result.error) throw new Error('학생 정보를 저장하지 못했습니다.');
  revalidatePath('/admin/coaching');
  revalidatePath('/admin/operations/schedule');
}
