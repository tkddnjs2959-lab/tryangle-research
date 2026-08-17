import { NextResponse } from 'next/server';
import { getActorSession } from '@/lib/actor-session';
import { getCheckoutOrderForActor, markTossPaymentPaid } from '@/lib/checkout-data';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getActorSession();
  if (!session) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const body = await req.json().catch(() => null) as { paymentKey?: unknown; orderId?: unknown; amount?: unknown } | null;
  const paymentKey = typeof body?.paymentKey === 'string' ? body.paymentKey : '';
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const amount = typeof body?.amount === 'number' ? body.amount : Number(body?.amount);
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!paymentKey || !orderId || !Number.isFinite(amount)) return NextResponse.json({ message: '결제 승인 정보가 부족합니다.' }, { status: 400 });
  if (!secretKey) return NextResponse.json({ message: '결제 승인 기능이 아직 설정되지 않았습니다.' }, { status: 503 });
  try {
    const order = await getCheckoutOrderForActor(session.actorId, orderId);
    if (!order) return NextResponse.json({ message: '주문을 찾을 수 없습니다.' }, { status: 404 });
    if (Number(order.amount) !== amount) return NextResponse.json({ message: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    if (order.status === 'paid') return NextResponse.json({ ok: true });
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey, orderId, amount }) });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) return NextResponse.json({ message: String(result.message ?? 'PG 승인에 실패했습니다.') }, { status: 400 });
    await markTossPaymentPaid({ actorId: session.actorId, orderId, paymentKey, amount, rawResponse: result });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : '결제 승인에 실패했습니다.' }, { status: 400 });
  }
}
