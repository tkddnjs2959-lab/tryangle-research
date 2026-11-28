'use server';
import { revalidatePath } from 'next/cache';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { passwordHash } from '@/lib/trainer-auth';
import { db } from '@/lib/supabase';

async function requireOwner() {
  const identity = await currentAdminIdentity();
  if (!identity || !['owner','admin'].includes(identity.role)) throw new Error('계정 관리 권한이 없습니다.');
}
export async function saveTrainerAccount(form: FormData) {
  await requireOwner();
  const id = String(form.get('id') ?? '');
  const loginId = String(form.get('loginId') ?? '').trim().toLowerCase();
  const displayName = String(form.get('displayName') ?? '').trim();
  const teacherName = String(form.get('teacherName') ?? '');
  const password = String(form.get('password') ?? '');
  const active = form.get('active') === 'on';
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('계정을 확인해 주세요.');
  if (!/^[a-z0-9._-]{4,40}$/.test(loginId) || !displayName || displayName.length > 80 || !['이주아 T','김유리 T'].includes(teacherName)) throw new Error('아이디와 트레이너 정보를 확인해 주세요.');
  if ((!id || password) && (password.length < 12 || password.length > 128)) throw new Error('비밀번호는 12~128자로 입력해 주세요.');
  const client = db();
  const payload = {login_id:loginId,display_name:displayName,teacher_name:teacherName,active,updated_at:new Date().toISOString(),...(password ? {password_hash:passwordHash(password)} : {})};
  const result = id
    ? await client.from('trainer_accounts').update(payload).eq('id',id).select('id').single()
    : await client.from('trainer_accounts').insert(payload).select('id').single();
  if (result.error || !result.data) throw new Error('계정 저장에 실패했습니다. 아이디 중복 여부를 확인해 주세요.');
  if (id && (!active || password)) await client.from('trainer_sessions').update({revoked_at:new Date().toISOString()}).eq('account_id',id).is('revoked_at',null);
  revalidatePath('/admin/accounts');
}
