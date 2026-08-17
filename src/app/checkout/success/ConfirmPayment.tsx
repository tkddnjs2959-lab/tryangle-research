'use client';

import { useEffect, useState } from 'react';
import styles from '../page.module.css';

export default function ConfirmPayment({ paymentKey, orderId, amount }: { paymentKey: string; orderId: string; amount: number }) {
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('PG 승인 결과를 확인하고 있습니다.');
  useEffect(() => { fetch('/api/checkout/toss/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey, orderId, amount }) }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.message ?? '결제 승인에 실패했습니다.'); setState('done'); setMessage('결제가 완료되었습니다. 등록 상태와 결제 내역에 반영했습니다.'); }).catch((error) => { setState('error'); setMessage(error instanceof Error ? error.message : '결제 승인에 실패했습니다.'); }); }, [paymentKey, orderId, amount]);
  return <div className={styles.notice}><h1 className={styles.noticeTitle}>{state === 'loading' ? '결제 확인 중입니다' : state === 'done' ? '결제가 완료되었습니다' : '결제 확인에 실패했습니다'}</h1><p className={styles.noticeBody}>{message}<br />주문번호 {orderId}</p>{state === 'error' && <a className={styles.payButton} href="/checkout">결제 화면으로 돌아가기</a>}</div>;
}
