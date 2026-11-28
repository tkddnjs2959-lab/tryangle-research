'use server';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function recordTuition(form: FormData) {
  if (!(await currentAdminIdentity())) throw new Error('로그인이 필요합니다.');
  const id = String(form.get('studentId') ?? '');
  const month = String(form.get('month') ?? '');
  const paidDate = String(form.get('paidDate') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || (paidDate && !/^20\d{2}-\d{2}-\d{2}$/.test(paidDate))) throw new Error('학생과 납부일을 확인해 주세요.');
  const existing = await db().from('coaching_monthly_registrations').select('id').eq('student_id',id).eq('service_month',month + '-01').maybeSingle();
  if (existing.error) throw new Error('등록 내역을 조회하지 못했습니다.');
  if (existing.data) {
    const result = await db().from('coaching_monthly_registrations').update({ paid_date:paidDate || null, updated_at:new Date().toISOString() }).eq('id',existing.data.id);
    if (result.error) throw new Error('납부일을 저장하지 못했습니다.');
  } else {
    const student = await db().from('coaching_students').select('lesson_plan, homeroom_teacher, monthly_tuition').eq('id',id).single();
    if (student.error) throw new Error('학생 정보를 찾지 못했습니다.');
    const result = await db().from('coaching_monthly_registrations').insert({student_id:id,service_month:month + '-01',lesson_plan:student.data.lesson_plan,teacher:student.data.homeroom_teacher,tuition:student.data.monthly_tuition,paid_date:paidDate || null});
    if (result.error) throw new Error('납부일을 저장하지 못했습니다. 다시 시도해 주세요.');
  }
  revalidatePath('/admin/operations/receipts');
  revalidatePath('/admin/operations/closing');
}
