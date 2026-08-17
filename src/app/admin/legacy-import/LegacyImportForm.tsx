'use client';

import { useState } from 'react';
import { parseLegacyConsultationText, type LegacyImportRow } from '@/lib/legacy-consultation-parser';
import styles from '../admin.module.css';

export default function LegacyImportForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [rows, setRows] = useState<LegacyImportRow[]>([]);
  const [filename, setFilename] = useState('');
  const [text, setText] = useState('');
  const load = (file?: File) => { if (!file || !file.name.toLowerCase().endsWith('.txt')) return; setFilename(file.name); const reader = new FileReader(); reader.onload = () => { const value = String(reader.result ?? ''); setText(value); setRows(parseLegacyConsultationText(value)); }; reader.readAsText(file, 'UTF-8'); };
  return <form action={action} className={styles.consultForm}>
    <input type="file" accept=".txt,text/plain" onChange={(event) => load(event.target.files?.[0])} required />
    <input type="hidden" name="sourceFilename" value={filename} />
    <textarea name="sourceText" value={text} onChange={(event) => { setText(event.target.value); setRows(parseLegacyConsultationText(event.target.value)); }} className={styles.consultTextarea} rows={8} placeholder="TXT 파일을 선택하면 원문을 확인할 수 있습니다." required />
    {rows.length > 0 && <div className={styles.banner}><strong>미리보기</strong><div>{rows.filter((row) => row.recordKind === 'consultation').length}건 상담 · {rows.filter((row) => row.recordKind === 'student_profile').length}건 수강생 프로필 · {rows.filter((row) => row.recordKind === 'unknown').length}건 확인 필요</div></div>}
    <button className={styles.btn} type="submit" disabled={!text.trim()}>staging으로 가져오기</button>
  </form>;
}
