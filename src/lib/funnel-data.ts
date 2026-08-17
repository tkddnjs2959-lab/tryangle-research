import 'server-only';
import { db } from './supabase';

export type EnrollmentStatus = 'applied' | 'enrolled' | 'paused' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'void';

export type EnrollmentRow = {
  id: string;
  inquiryId: string | null;
  actorId: string | null;
  cohort: string | null;
  productName: string | null;
  amount: number | null;
  status: EnrollmentStatus;
  enrolledAt: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  note: string | null;
  createdAt: string;
  payments: PaymentRow[];
};

export type PaymentRow = {
  id: string;
  enrollmentId: string;
  paidAt: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: string | null;
  note: string | null;
};

export async function listFunnelRecords(): Promise<EnrollmentRow[]> {
  const client = db();
  const [{ data: enrollments, error: enrollmentError }, { data: payments, error: paymentError }] = await Promise.all([
    client.from('enrollments').select('id, inquiry_id, actor_id, cohort, product_name, amount, status, enrolled_at, source, medium, campaign, note, created_at').order('created_at', { ascending: false }),
    client.from('payments').select('id, enrollment_id, paid_at, amount, currency, status, payment_type, note').order('created_at', { ascending: false }),
  ]);
  if (enrollmentError) throw new Error(enrollmentError.message);
  if (paymentError) throw new Error(paymentError.message);

  const paymentsByEnrollment = new Map<string, PaymentRow[]>();
  for (const row of payments ?? []) {
    const item: PaymentRow = {
      id: row.id as string,
      enrollmentId: row.enrollment_id as string,
      paidAt: row.paid_at as string | null,
      amount: Number(row.amount ?? 0),
      currency: row.currency as string,
      status: row.status as PaymentStatus,
      paymentType: row.payment_type as string | null,
      note: row.note as string | null,
    };
    const list = paymentsByEnrollment.get(item.enrollmentId) ?? [];
    list.push(item);
    paymentsByEnrollment.set(item.enrollmentId, list);
  }

  return (enrollments ?? []).map((row) => ({
    id: row.id as string,
    inquiryId: row.inquiry_id as string | null,
    actorId: row.actor_id as string | null,
    cohort: row.cohort as string | null,
    productName: row.product_name as string | null,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    status: row.status as EnrollmentStatus,
    enrolledAt: row.enrolled_at as string | null,
    source: row.source as string | null,
    medium: row.medium as string | null,
    campaign: row.campaign as string | null,
    note: row.note as string | null,
    createdAt: row.created_at as string,
    payments: paymentsByEnrollment.get(row.id as string) ?? [],
  }));
}

export async function createEnrollment(input: {
  inquiryId: string | null;
  actorId: string | null;
  cohort: string | null;
  productName: string | null;
  amount: number | null;
  status: EnrollmentStatus;
  enrolledAt: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  note: string | null;
}) {
  const { data, error } = await db().from('enrollments').insert({
    inquiry_id: input.inquiryId,
    actor_id: input.actorId,
    cohort: input.cohort,
    product_name: input.productName,
    amount: input.amount,
    status: input.status,
    enrolled_at: input.enrolledAt,
    source: input.source,
    medium: input.medium,
    campaign: input.campaign,
    note: input.note,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function createPayment(input: {
  enrollmentId: string;
  amount: number;
  paidAt: string | null;
  status: PaymentStatus;
  paymentType: string | null;
  note: string | null;
}) {
  const { error } = await db().from('payments').insert({
    enrollment_id: input.enrollmentId,
    amount: input.amount,
    paid_at: input.paidAt,
    status: input.status,
    payment_type: input.paymentType,
    note: input.note,
  });
  if (error) throw new Error(error.message);
}
