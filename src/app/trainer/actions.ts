'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signInTrainer, signOutTrainer, trainerIdentity } from '@/lib/trainer-auth';
import { db } from '@/lib/supabase';

export async function trainerLogin(form: FormData) {
  const id=String(form.get('loginId')??'').trim().toLowerCase();
  const password=String(form.get('password')??'');
  if (!/^[a-z0-9._-]{4,40}$/.test(id) || password.length>128 || !(await signInTrainer(id,password))) redirect('/trainer/login?error=1');
  redirect('/trainer');
}
export async function trainerLogout() { await signOutTrainer(); redirect('/trainer/login'); }
export async function trainerRecordTuition(form: FormData) {
  const identity=await trainerIdentity();
  if (!identity) redirect('/trainer/login');
  const studentId=String(form.get('studentId')??'');
  const month=String(form.get('month')??'');
  const paidDate=String(form.get('paidDate')??'');
  if (!/^[0-9a-f-]{36}$/i.test(studentId) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || (paidDate && (!/^20\d{2}-\d{2}-\d{2}$/.test(paidDate) || Number.isNaN(Date.parse(paidDate))))) throw new Error('날짜를 확인해 주세요.');
  const client=db();
  const student=await client.from('coaching_students').select('id,lesson_plan,homeroom_teacher,assistant_teacher,monthly_tuition,status').eq('id',studentId).or(`homeroom_teacher.eq.${identity.teacherName},assistant_teacher.eq.${identity.teacherName}`).single();
  if (student.error || !student.data || student.data.status==='archived') throw new Error('담당 학생만 수납을 확인할 수 있습니다.');
  const existing=await client.from('coaching_monthly_registrations').select('id,paid_date').eq('student_id',studentId).eq('service_month',month+'-01').maybeSingle();
  if (existing.error) throw new Error('수납 기록을 확인하지 못했습니다.');
  const oldDate=existing.data?.paid_date??null;
  const newDate=paidDate||null;
  if (oldDate===newDate) return;
  const saved=existing.data
    ? await client.from('coaching_monthly_registrations').update({paid_date:newDate,updated_at:new Date().toISOString()}).eq('id',existing.data.id)
    : await client.from('coaching_monthly_registrations').insert({student_id:studentId,service_month:month+'-01',paid_date:newDate,lesson_plan:student.data.lesson_plan,teacher:student.data.homeroom_teacher,tuition:student.data.monthly_tuition});
  if (saved.error) throw new Error('수납일을 저장하지 못했습니다.');
  const audit=await client.from('trainer_tuition_audit').insert({student_id:studentId,service_month:month+'-01',old_paid_date:oldDate,new_paid_date:newDate,trainer_account_id:identity.id});
  if (audit.error) throw new Error('수납 변경 이력을 기록하지 못했습니다. 관리자에게 문의해 주세요.');
  revalidatePath('/trainer');
  revalidatePath('/admin/operations/receipts');
}
