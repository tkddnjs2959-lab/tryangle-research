import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './supabase';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-tryangle_trainer' : 'tryangle_trainer';
const AGE = 60 * 60 * 8;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export type TrainerIdentity = { id: string; displayName: string; teacherName: string };
export function passwordHash(password: string) {
  const salt = randomBytes(16);
  return salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyTrainerPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(digest)) return false;
  const expected = Buffer.from(digest, 'hex');
  return timingSafeEqual(scryptSync(password, Buffer.from(salt,'hex'), 64), expected);
}
export async function trainerIdentity(): Promise<TrainerIdentity | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const result = await db().from('trainer_sessions').select('account_id, trainer_accounts!inner(id,display_name,teacher_name,active)').eq('token_hash',hash(token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
  if (result.error || !result.data) return null;
  const joined = result.data.trainer_accounts as unknown as {id:string;display_name:string;teacher_name:string;active:boolean} | {id:string;display_name:string;teacher_name:string;active:boolean}[];
  const account = Array.isArray(joined) ? joined[0] : joined;
  if (!account?.active) return null;
  return { id:account.id, displayName:account.display_name, teacherName:account.teacher_name };
}
export async function signInTrainer(loginId: string, password: string) {
  const result = await db().from('trainer_accounts').select('id,password_hash,active').eq('login_id',loginId).maybeSingle();
  // Invalid IDs and passwords share the same response.
  if (result.error || !result.data?.active || !verifyTrainerPassword(password,result.data.password_hash)) return false;
  const token = randomBytes(32).toString('hex');
  const insert = await db().from('trainer_sessions').insert({token_hash:hash(token),account_id:result.data.id,expires_at:new Date(Date.now()+AGE*1000).toISOString()});
  if (insert.error) throw new Error('로그인 세션을 만들지 못했습니다.');
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:AGE});
  return true;
}
export async function signOutTrainer() {
  const jar=await cookies();
  const token=jar.get(COOKIE)?.value;
  if (token) await db().from('trainer_sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',hash(token));
  jar.delete(COOKIE);
}
