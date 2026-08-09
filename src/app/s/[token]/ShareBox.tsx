'use client';

import { useState } from 'react';
import type { SurveyProgress } from '@/lib/research';
import { AUDIENCE, CATEGORY_LABEL } from '@/lib/types';
import styles from './page.module.css';

/**
 * 링크 배포 상자 — 이 화면의 진짜 목적.
 *
 * 링크만 주면 배우가 "뭐라고 보내지" 하다가 미룬다.
 * 카톡에 그대로 붙여넣을 문구를 통째로 복사해준다.
 */
export default function ShareBox({
  actorName,
  surveys,
}: {
  actorName: string;
  surveys: SurveyProgress[];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  // 서버에서는 origin 을 알 수 없으므로 클릭 시점에 만든다
  const message = (type: SurveyProgress['type'], token: string) => {
    const link = `${window.location.origin}/r/${token}`;
    if (type === 'image') {
      return (
        `안녕하세요! ${actorName}입니다.\n` +
        `배우 활동을 준비하면서 제가 어떤 이미지로 보이는지 리서치를 하고 있어요.\n\n` +
        `키워드에 체크만 해주시면 되고 2분이면 끝납니다.\n` +
        `깊이 고민하지 마시고 떠오르는 대로 빠르게 골라주시는 게 더 정확해요.\n\n` +
        `${link}\n\n` +
        `응답은 익명으로 처리되고, 누가 무엇을 골랐는지는 저도 알 수 없습니다.\n` +
        `감사합니다!`
      );
    }
    return (
      `나 ${actorName}이야!\n` +
      `배우 준비하면서 내가 어떤 사람인지 리서치 중인데 좀 도와줄래?\n\n` +
      `키워드 체크만 하면 되고 2분이면 돼.\n` +
      `평소에 본 내 성격 그대로 골라줘. 솔직할수록 좋아.\n\n` +
      `${link}\n\n` +
      `익명이라 누가 뭘 골랐는지는 나도 못 봐. 고마워!`
    );
  };

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드 권한이 없는 환경 대비
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

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>링크 보내기</h2>
      <p className={styles.blockHint}>
        버튼을 누르면 링크와 안내 문구가 함께 복사됩니다. 카톡에 그대로 붙여넣으세요.
      </p>

      {surveys.map((s) => (
        <div key={s.type}>
          {s.isOpen ? (
            <button
              type="button"
              className={styles.share}
              onClick={() => copy(s.type, message(s.type, s.token))}
            >
              <span className={styles.shareText}>
                <strong>{CATEGORY_LABEL[s.type]}</strong>
                <em>{AUDIENCE[s.type]}</em>
              </span>
              <span className={styles.shareBtn}>
                {copied === s.type ? '복사됨' : '복사'}
              </span>
            </button>
          ) : (
            <div className={`${styles.share} ${styles.shareOff}`}>
              <span className={styles.shareText}>
                <strong>{CATEGORY_LABEL[s.type]}</strong>
                <em>인원이 모두 모여 마감되었습니다</em>
              </span>
              <span className={styles.closedTag}>마감</span>
            </div>
          )}
        </div>
      ))}

      <p className={styles.warn}>
        두 링크는 보내는 대상이 다릅니다. 이미지 리서치에 가족·연인·친한 지인이 참여하면
        결과가 정확하지 않게 됩니다.
      </p>
    </section>
  );
}
