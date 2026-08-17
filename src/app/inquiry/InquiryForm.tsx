'use client';

import { FormEvent, useState } from 'react';
import styles from './page.module.css';

export default function InquiryForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending'); setError('');
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    const payload = {
      name: form.get('name'), contact: form.get('contact'), message: form.get('message'), website: form.get('website'),
      source: params.get('utm_source') || 'website', medium: params.get('utm_medium') || 'unknown',
      campaign: params.get('utm_campaign') || 'unknown', content: params.get('utm_content') || 'unknown',
    };
    try {
      const response = await fetch('/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || '문의 접수에 실패했습니다.');
      setState('done'); event.currentTarget.reset();
    } catch (e) { setError(e instanceof Error ? e.message : '문의 접수에 실패했습니다.'); setState('error'); }
  }

  if (state === 'done') return <div className={styles.success}><h2>문의가 접수되었습니다.</h2><p>운영팀이 확인 후 연락드리겠습니다. 감사합니다.</p><button type="button" className={styles.secondary} onClick={() => setState('idle')}>새 문의 작성</button></div>;
  return <form className={styles.form} onSubmit={submit}>
    <label>이름<input name="name" maxLength={40} required placeholder="이름을 입력해주세요" /></label>
    <label>연락처<input name="contact" maxLength={60} required placeholder="전화번호 또는 카카오톡 ID" /></label>
    <label>상담 내용<textarea name="message" maxLength={1000} rows={6} placeholder="궁금한 점을 자유롭게 적어주세요" /></label>
    <input name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true" />
    {state === 'error' && <p className={styles.error}>{error}</p>}
    <button className={styles.submit} disabled={state === 'sending'}>{state === 'sending' ? '접수 중…' : '상담 문의 보내기'}</button>
  </form>;
}
