'use client';
import { useState } from 'react';
import styles from '../admin.module.css';

export default function TuitionInput({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial ? Number(initial).toLocaleString('ko-KR') : '');
  return <input className={styles.input} name="monthlyTuition" type="text" inputMode="numeric" placeholder="월 수강료 (원)"
    value={value} onChange={event => {
      const digits = event.target.value.replace(/[^0-9]/g, '').slice(0, 9);
      setValue(digits ? Number(digits).toLocaleString('ko-KR') : '');
    }} />;
}
