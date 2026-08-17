import { NextResponse } from 'next/server';
import { getActorSession } from '@/lib/actor-session';
import { createCheckoutOrder } from '@/lib/checkout-data';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getActorSession();
  if (!session) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await req.json().catch(() => null) as { enrollmentId?: unknown } | null;
  const enrollmentId = typeof body?.enrollmentId === 'string' ? body.enrollmentId : '';
  if (!enrollmentId) return NextResponse.json({ message: '등록 정보를 선택해주세요.' }, { status: 400 });
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) return NextResponse.json({ message: '결제 기능이 아직 설정되지 않았습니다.' }, { status: 503 });
  try {
    const order = await createCheckoutOrder(session.actorId, enrollmentId);
    return NextResponse.json({ ...order, clientKey });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : '주문을 만들지 못했습니다.' }, { status: 400 });
  }
}
