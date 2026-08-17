'use client';

import { useRef, useState } from 'react';
import styles from '../admin.module.css';

type TargetOption = { id: string; label: string };
type ServerAction = (formData: FormData) => void | Promise<void>;

export default function ConsultationImportForm({ action, options }: { action: ServerAction; options: TargetOption[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);

  const readFile = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
      setFileError('TXT 파일만 업로드할 수 있습니다.'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError('파일은 2MB 이하만 업로드할 수 있습니다.'); return;
    }
    setFileError(''); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setTranscript(String(reader.result ?? '').trim());
    reader.onerror = () => setFileError('파일을 읽지 못했습니다.');
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <form action={action} className={styles.consultForm} onSubmit={(event) => {
      if (!transcript.trim()) { event.preventDefault(); setFileError('TXT 파일을 첨부하거나 상담 텍스트를 입력해 주세요.'); }
    }}>
      <div className={styles.consultGrid}>
        <select name="targetId" className={styles.input} required>
          <option value="">상담 대상 선택</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <input name="consultedAt" type="datetime-local" className={styles.input} required />
        <input name="consultationType" className={styles.input} placeholder="상담 유형" defaultValue="general" />
      </div>
      <input ref={fileInputRef} type="file" accept=".txt,text/plain" hidden onChange={(event) => readFile(event.target.files?.[0])} />
      <button type="button" className={`${styles.consultDropzone} ${dragging ? styles.consultDropzoneActive : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files[0]); }}>
        <strong>{fileName || 'Clova Note TXT 파일을 끌어 놓거나 클릭해 선택'}</strong>
        <span>파일을 읽은 뒤 아래 텍스트를 확인·수정하고 저장합니다.</span>
      </button>
      <textarea name="transcript" className={styles.consultTextarea} rows={10} required value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="상담 텍스트를 붙여넣거나 TXT 파일을 첨부해 주세요." />
      {fileError && <p className={styles.warn}>{fileError}</p>}
      <label className={styles.consentCheck}><input type="checkbox" name="consent" required /> 상담 분석 및 보관에 대한 동의를 확인했습니다.</label>
      <button className={styles.btn} type="submit">저장 후 자동 분석</button>
    </form>
  );
}
