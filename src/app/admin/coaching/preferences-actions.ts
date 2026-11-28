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
  const assistantTeacher = String(form.get('assistantTeacher') ?? '');
  const tuitionRaw = String(form.get('monthlyTuition') ?? '').trim();
  const monthlyTuition = tuitionRaw ? Number(tuitionRaw.replaceAll(',', '')) : null;
  if (monthlyTuition !== null && (!Number.isSafeInteger(monthlyTuition) || monthlyTuition < 0 || monthlyTuition > 100000000)) throw new Error('수강 금액을 확인해 주세요.');
  const birth = String(form.get('birthYear') ?? '').trim();
  const birthYear = birth ? Number(birth) : null;
  const gender = String(form.get('gender') ?? '');
  const status = String(form.get('status') ?? 'active');
  if (plan === 'pair_twice' && (!teacher || !assistantTeacher || teacher === assistantTeacher)) throw new Error('주 2회 수업은 서로 다른 담임과 부담임을 선택해 주세요.');
  if (assistantTeacher && !['이주아 T','김유리 T'].includes(assistantTeacher)) throw new Error('부담임을 확인해 주세요.');
  if (!['active','waitlist','unregistered','leave','withdrawn'].includes(status)) throw new Error('학생 상태를 확인해 주세요.');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > 120 || contact.length > 120 || residence.length > 120 || note.length > 2000 || !['female','male'].includes(gender) || (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > 2100)) || (plan && !['one_lead','one_team','pair_once','pair_twice'].includes(plan)) || (teacher && !['이주아 T','김유리 T'].includes(teacher))) throw new Error('학생 정보를 확인해 주세요.');
  const firstStartDate = String(form.get('firstStartDate') ?? '').trim();
  if (firstStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(firstStartDate)) throw new Error('첫 시작일을 확인해 주세요.');
  const result = await db().from('coaching_students').update({
    name, contact: contact || null, residence: residence || null, note: note || null,
    birth_year: birthYear, gender, status, lesson_plan: plan || null,
    homeroom_teacher: teacher || null, assistant_teacher: assistantTeacher || null, first_start_date: firstStartDate || null, monthly_tuition: monthlyTuition,
  }).eq('id', id).neq('status','archived').select('id').single();
  if (result.error) throw new Error('학생 정보를 저장하지 못했습니다.');
  revalidatePath('/admin/coaching');
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/operations/schedule');
}
