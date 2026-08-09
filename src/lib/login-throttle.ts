import 'server-only';
import { headers } from 'next/headers';
import { db } from './supabase';

/**
 * 어드민 로그인 시도 제한.
 *
 * 공개 배포된 /admin/login 은 비밀번호 하나로 보호된다.
 * 시도 제한이 없으면 대입 공격을 막을 수단이 전혀 없다.
 *
 * 창(WINDOW) 안에서 MAX_FAILS 번 틀리면 LOCK 동안 잠근다.
 * 성공하면 기록을 지운다.
 */

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 실패 횟수를 세는 구간
const LOCK_MS = 15 * 60 * 1000; // 초과 시 잠기는 시간

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel 은 x-forwarded-for 맨 앞에 실제 클라이언트 IP 를 넣는다.
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim();
  return ip || 'unknown';
}

type Row = {
  ip: string;
  fails: number;
  window_start: string;
  locked_until: string | null;
};

async function load(ip: string): Promise<Row | null> {
  const { data, error } = await db()
    .from('admin_login_attempts')
    .select('ip, fails, window_start, locked_until')
    .eq('ip', ip)
    .maybeSingle();
  if (error) {
    // 제한 장치가 고장 났다고 로그인 자체를 막지는 않는다.
    console.error('로그인 시도 기록 조회 실패', error.message);
    return null;
  }
  return (data as Row | null) ?? null;
}

/** 잠겨 있으면 남은 초를 준다. 잠겨 있지 않으면 null. */
export async function lockedSeconds(ip: string): Promise<number | null> {
  const row = await load(ip);
  if (!row?.locked_until) return null;

  const remain = new Date(row.locked_until).getTime() - Date.now();
  return remain > 0 ? Math.ceil(remain / 1000) : null;
}

/** 비밀번호가 틀렸을 때. 잠기게 됐으면 남은 초를 준다. */
export async function recordFailure(ip: string): Promise<number | null> {
  const row = await load(ip);
  const now = Date.now();

  // 창이 지났으면 처음부터 다시 센다.
  const windowExpired = row ? now - new Date(row.window_start).getTime() > WINDOW_MS : true;
  const fails = row && !windowExpired ? row.fails + 1 : 1;
  const shouldLock = fails >= MAX_FAILS;

  const { error } = await db()
    .from('admin_login_attempts')
    .upsert(
      {
        ip,
        fails,
        window_start: row && !windowExpired ? row.window_start : new Date(now).toISOString(),
        locked_until: shouldLock ? new Date(now + LOCK_MS).toISOString() : null,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'ip' }
    );
  if (error) console.error('로그인 시도 기록 실패', error.message);

  return shouldLock ? Math.ceil(LOCK_MS / 1000) : null;
}

export async function clearFailures(ip: string): Promise<void> {
  const { error } = await db().from('admin_login_attempts').delete().eq('ip', ip);
  if (error) console.error('로그인 시도 기록 정리 실패', error.message);
}

/** 남은 초를 '3분 20초' 같은 사람 말로 */
export function humanizeSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  return `${s}초`;
}
