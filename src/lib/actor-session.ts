import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'actor_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export type ActorSession = {
  actorId: string;
  kakaoUserId: string;
  expires: number;
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET 환경변수가 없습니다.');
  return s;
}

function b64(input: string) {
  return Buffer.from(input).toString('base64url');
}

function unb64(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function createActorSession(actorId: string, kakaoUserId: string) {
  const session: ActorSession = {
    actorId,
    kakaoUserId,
    expires: Date.now() + MAX_AGE * 1000,
  };
  const payload = b64(JSON.stringify(session));
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function getActorSession(): Promise<ActorSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  if (!safeEqual(sig, sign(payload))) return null;
  try {
    const session = JSON.parse(unb64(payload)) as ActorSession;
    if (!session.actorId || !session.kakaoUserId || session.expires < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function destroyActorSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
