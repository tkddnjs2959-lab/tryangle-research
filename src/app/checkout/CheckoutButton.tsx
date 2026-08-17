'use client';

import { useState } from 'react';
import styles from './page.module.css';

declare global { interface Window { TossPayments?: (clientKey: string) => { requestPayment: (method: string, options: Record<string, unknown>) => Promise<void> }; } }

export default function CheckoutButton({ enrollmentId, enabled }: { enrollmentId: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function start() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/checkout/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrollmentId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '주문을 만들지 못했습니다.');
      if (!window.TossPayments) {
        await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://js.tosspayments.com/v1/payment'; script.onload = () => resolve(); script.onerror = () => reject(new Error('결제 모듈을 불러오지 못했습니다.')); document.head.appendChild(script); });
      }
      await window.TossPayments!(result.clientKey).requestPayment('카드', { amount: result.amount, orderId: result.orderId, orderName: result.orderName, successUrl: `${window.location.origin}/checkout/success`, failUrl: `${window.location.origin}/checkout/fail` });
    } catch (error) { setMessage(error instanceof Error ? error.message : '결제를 시작하지 못했습니다.'); setBusy(false); }
  }
  return <div className={styles.payAction}><button className={styles.payButton} type="button" onClick={start} disabled={!enabled || busy}>{busy ? '결제창 준비 중…' : enabled ? '결제하기' : 'PG 설정 대기'}</button>{message && <p className={styles.error}>{message}</p>}</div>;
}
