'use client';

import { useMemo, useState } from 'react';
import {
  RECOMMEND_MAX,
  RECOMMEND_MIN,
  SECTION_LABEL,
  type Keyword,
  type SurveyView,
} from '@/lib/types';
import styles from './page.module.css';

export default function ResearchForm({ survey }: { survey: SurveyView }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [custom, setCustom] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // 셀프 체크는 이미지·퍼스널리티 두 표를 모두 보여준다
  const sections = useMemo(() => {
    const by: Record<'image' | 'personality', Keyword[]> = { image: [], personality: [] };
    for (const k of survey.keywords) by[k.category].push(k);
    return (['image', 'personality'] as const)
      .filter((c) => by[c].length > 0)
      .map((c) => ({ category: c, items: by[c] }));
  }, [survey.keywords]);

  const customList = useMemo(
    () =>
      custom
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [custom]
  );

  const total = picked.size + customList.length;
  const inRange = total >= RECOMMEND_MIN && total <= RECOMMEND_MAX;

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (total === 0) {
      setError('키워드를 하나 이상 선택해주세요.');
      return;
    }
    setState('sending');
    setError(null);
    try {
      const res = await fetch(`/api/r/${survey.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordIds: [...picked], custom: customList }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? '제출에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('네트워크 오류입니다. 연결을 확인하고 다시 시도해주세요.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className={styles.notice}>
        <h2 className={styles.noticeTitle}>참여해주셔서 감사합니다</h2>
        <p className={styles.noticeBody}>응답이 저장되었습니다. 이 창은 닫으셔도 됩니다.</p>
      </div>
    );
  }

  return (
    <>
      {sections.map(({ category, items }) => (
        <section key={category} className={styles.section}>
          {sections.length > 1 && (
            <h2 className={styles.sectionTitle}>{SECTION_LABEL[category]}</h2>
          )}
          <div className={styles.grid}>
            {items.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`${styles.kw} ${picked.has(k.id) ? styles.kwOn : ''}`}
                aria-pressed={picked.has(k.id)}
                onClick={() => toggle(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>기타 키워드</h2>
        <p className={styles.hint}>
          위 표에 없는 표현이 떠오르셨다면 적어주세요. 쉼표로 구분합니다. (선택)
        </p>
        <input
          className={styles.input}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="예: 청량한, 시원시원한"
        />
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.bar}>
        <div className={styles.barInner}>
          <span className={`${styles.count} ${inRange ? styles.countOk : ''}`}>
            {total}개 선택
            <em>
              {' '}
              · {RECOMMEND_MIN}~{RECOMMEND_MAX}개 권장
            </em>
          </span>
          <button
            type="button"
            className={styles.submit}
            onClick={submit}
            disabled={state === 'sending' || total === 0}
          >
            {state === 'sending' ? '제출 중…' : '제출하기'}
          </button>
        </div>
      </div>
    </>
  );
}
