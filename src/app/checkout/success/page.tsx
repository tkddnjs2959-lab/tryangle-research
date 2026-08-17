import { redirect } from 'next/navigation';
import { getActorSession } from '@/lib/actor-session';
import ConfirmPayment from './ConfirmPayment';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }> }) {
  const session = await getActorSession();
  const params = await searchParams;
  if (!session || !params.paymentKey || !params.orderId || !params.amount) redirect('/checkout');
  return <main className={styles.page}><div className={styles.sheet}><ConfirmPayment paymentKey={params.paymentKey} orderId={params.orderId} amount={Number(params.amount)} /></div></main>;
}
