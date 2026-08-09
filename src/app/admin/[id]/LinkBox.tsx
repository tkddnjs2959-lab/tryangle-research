'use client';

import { useState } from 'react';
import { AUDIENCE, CATEGORY_LABEL, type Category } from '@/lib/types';
import styles from '../admin.module.css';

export default function LinkBox({
  progressToken,
  surveys,
}: {
  progressToken: string;
  surveys: { type: Category; token: string }[];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  const rows = [
    {
      key: 'progress',
      title: '진행 현황',
      desc: '배우 본인 — 이 링크만 보내면 나머지는 여기서 복사합니다',
      path: `/s/${progressToken}`,
    },
    ...surveys.map((s) => ({
      key: s.type,
      title: CATEGORY_LABEL[s.type],
      desc: AUDIENCE[s.type],
      path: `/r/${s.token}`,
    })),
  ];

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>링크</h2>
      <p className={styles.blockHint}>
        배우에게는 <b>진행 현황</b> 링크 하나만 보내면 됩니다. 나머지 링크는 배우가 그 화면에서
        안내 문구와 함께 복사해 지인에게 전달합니다.
      </p>
      {rows.map((r) => (
        <div key={r.key} className={styles.linkRow}>
          <div className={styles.linkText}>
            <strong>{r.title}</strong>
            <em>{r.desc}</em>
            <code>{r.path}</code>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
            onClick={() => copy(r.key, `${window.location.origin}${r.path}`)}
          >
            {copied === r.key ? '복사됨' : '복사'}
          </button>
        </div>
      ))}
    </section>
  );
}
