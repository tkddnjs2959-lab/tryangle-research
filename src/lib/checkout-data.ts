import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from './supabase';

export type PayableEnrollment = {
  id: string;
  productName: string;
  amount: number;
  cohort: string | null;
};

export async function listPayableEnrollments(actorId: string): Promise<PayableEnrollment[]> {
  const { data, error } = await db()
    .from('enrollments')
    .select('id, product_name, amount, cohort, status')
    .eq('actor_id', actorId)
    .in('status', ['applied', 'enrolled']);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => row.amount !== null && Number(row.amount) > 0 && row.product_name)
    .map((row) => ({ id: row.id as string, productName: row.product_name as string, amount: Number(row.amount), cohort: row.cohort as string | null }));
}

export async function createCheckoutOrder(actorId: string, enrollmentId: string) {
  const { data: enrollment, error: enrollmentError } = await db()
    .from('enrollments')
    .select('id, actor_id, product_name, amount, cohort, status')
    .eq('id', enrollmentId)
    .eq('actor_id', actorId)
    .in('status', ['applied', 'enrolled'])
    .maybeSingle();
  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollment || !enrollment.product_name || !enrollment.amount || Number(enrollment.amount) <= 0) {
    throw new Error('결제 가능한 등록 정보가 없습니다.');
  }

  const orderId = `TRY-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const { data: order, error } = await db().from('checkout_orders').insert({
    enrollment_id: enrollment.id,
    actor_id: actorId,
    order_id: orderId,
    provider: 'toss',
    order_name: enrollment.product_name,
    amount: Number(enrollment.amount),
    currency: 'KRW',
    status: 'ready',
  }).select('order_id, order_name, amount').single();
  if (error) throw new Error(error.message);
  return { orderId: order.order_id as string, orderName: order.order_name as string, amount: Number(order.amount) };
}

export async function getCheckoutOrderForActor(actorId: string, orderId: string) {
  const { data, error } = await db().from('checkout_orders').select('id, order_id, enrollment_id, actor_id, order_name, amount, status, provider_payment_key').eq('actor_id', actorId).eq('order_id', orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function markTossPaymentPaid(input: { actorId: string; orderId: string; paymentKey: string; amount: number; rawResponse: unknown }) {
  const order = await getCheckoutOrderForActor(input.actorId, input.orderId);
  if (!order) throw new Error('주문을 찾을 수 없습니다.');
  if (Number(order.amount) !== input.amount) throw new Error('결제 금액이 주문 금액과 다릅니다.');
  if (order.status === 'paid') return;
  const client = db();
  const { error: orderError } = await client.from('checkout_orders').update({ status: 'paid', provider_payment_key: input.paymentKey, raw_response: input.rawResponse, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'ready');
  if (orderError) throw new Error(orderError.message);
  const { error: paymentError } = await client.from('payments').insert({ enrollment_id: order.enrollment_id, paid_at: new Date().toISOString(), amount: input.amount, currency: 'KRW', status: 'paid', payment_type: 'toss', note: `PG 승인 ${input.paymentKey}` });
  if (paymentError && !paymentError.message.includes('duplicate')) throw new Error(paymentError.message);
  const { error: enrollmentError } = await client.from('enrollments').update({ status: 'enrolled', updated_at: new Date().toISOString() }).eq('id', order.enrollment_id).eq('actor_id', input.actorId);
  if (enrollmentError) throw new Error(enrollmentError.message);
}
