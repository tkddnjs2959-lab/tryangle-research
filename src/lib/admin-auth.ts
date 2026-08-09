import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'admin_session';
const MAX_AGE = 60 * 60 * 12; // 12시간

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET 환경변수가 없습니다.');
  return s;
}

/** 만료시각을 담아 서명한다. 쿠키를 고쳐도 서명이 깨진다. */
function sign(expires: number) {
  return createHmac('sha256', secret()).update(String(expires)).digest('hex');
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('ADMIN_PASSWORD 환경변수가 없습니다.');
  // 길이가 달라도 상수 시간에 가깝게 비교
  return safeEqual(createHmac('sha256', secret()).update(input).digest('hex'),
                   createHmac('sha256', secret()).update(pw).digest('hex'));
}

export async function createSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const jar = await cookies();
  jar.set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isLoggedIn(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;

  const [expStr, sig] = raw.split('.');
  const expires = Number(expStr);
  if (!expStr || !sig || !Number.isFinite(expires)) return false;
  if (expires < Date.now()) return false;

  try {
    return safeEqual(sig, sign(expires));
  } catch {
    return false;
  }
}
