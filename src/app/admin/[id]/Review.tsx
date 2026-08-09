'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultConfig,
  drawBubble,
  drawReport,
  FONTS,
  loadFont,
  prepare,
  type BubbleConfig,
  type FontKey,
  type Item,
} from '@/lib/render';
import { saveSnapshot } from '../actions';
import styles from '../admin.module.css';

type Side = { items: Item[]; n: number; self: string[] };

export default function Review({
  actorId,
  actorName,
  birthYear,
  image,
  personality,
}: {
  actorId: string;
  actorName: string;
  birthYear: number | null;
  image: Side;
  personality: Side;
}) {
  const [cat, setCat] = useState<'image' | 'personality'>('image');
  const [cfgs, setCfgs] = useState<Record<'image' | 'personality', BubbleConfig>>({
    image: defaultConfig(),
    personality: defaultConfig(),
  });
  const [dropped, setDropped] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

  const bubbleRef = useRef<HTMLCanvasElement>(null);
  const reportRef = useRef<HTMLCanvasElement>(null);

  const side = cat === 'image' ? image : personality;
  const cfg = cfgs[cat];

  const set = (patch: Partial<BubbleConfig>) =>
    setCfgs((prev) => ({ ...prev, [cat]: { ...prev[cat], ...patch } }));

  const table = useMemo(() => prepare(side.items, side.n, cfg), [side, cfg]);

  const redraw = useCallback(async () => {
    await loadFont(cfg.font);
    if (bubbleRef.current) {
      const res = drawBubble(bubbleRef.current, {
        cat,
        actorName,
        items: side.items,
        n: side.n,
        cfg,
      });
      setDropped(res.dropped);
    }
    if (reportRef.current) {
      drawReport(reportRef.current, {
        actorName,
        birthYear,
        image: { items: image.items, n: image.n, self: image.self },
        personality: {
          items: personality.items,
          n: personality.n,
          self: personality.self,
        },
      });
    }
  }, [cat, cfg, side, actorName, birthYear, image, personality]);

  useEffect(() => {
    void redraw();
  }, [redraw]);

  function download(canvas: HTMLCanvasElement | null, suffix: string) {
    if (!canvas) return;
    const base = [actorName, birthYear && `${birthYear}년생`].filter(Boolean).join('_');
    const a = document.createElement('a');
    a.download = `${base}_${suffix}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  async function confirmSnapshot() {
    await saveSnapshot({
      actorId,
      kind: cat === 'image' ? 'bubble_image' : 'bubble_personality',
      config: cfg,
    });
    setSaved(cat);
    setTimeout(() => setSaved(null), 2500);
  }

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>1주차 분석 툴</h2>
      <p className={styles.blockHint}>
        1주차에는 퍼스널 리서치 응답을 바탕으로 이미지·퍼스널리티 말풍선과
        “내가 보는 나, 타인이 보는 나” 보고서를 검수합니다.
      </p>

      <div className={styles.segs}>
        {(['image', 'personality'] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.seg} ${cat === c ? styles.segOn : ''}`}
            onClick={() => setCat(c)}
          >
            {c === 'image' ? '이미지' : '퍼스널리티'} 말풍선
          </button>
        ))}
      </div>

      <div className={styles.reviewSplit}>
        <div>
          <div className={styles.ctrls}>
            <label className={styles.ctrl}>
              <span>강조 곡선</span>
              <input
                type="range"
                min={0.6}
                max={2.2}
                step={0.1}
                value={cfg.exponent}
                onChange={(e) => set({ exponent: Number(e.target.value) })}
              />
              <b>{cfg.exponent.toFixed(1)}</b>
            </label>
            <p className={styles.note}>클수록 최다 득표 키워드가 크게 도드라집니다 (기본 1.2)</p>

            <label className={styles.ctrl}>
              <span>키워드 간격</span>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={cfg.gap}
                onChange={(e) => set({ gap: Number(e.target.value) })}
              />
              <b>{cfg.gap}</b>
            </label>
            <p className={styles.note}>작을수록 오밀조밀하게 붙습니다 (기본 2)</p>

            <label className={styles.ctrl}>
              <span>1표 키워드</span>
              <select
                value={cfg.singleVote}
                onChange={(e) => set({ singleVote: e.target.value as BubbleConfig['singleVote'] })}
              >
                <option value="small">아주 작게 · 연한 색으로 포함</option>
                <option value="exclude">말풍선에서 제외</option>
              </select>
            </label>

            <label className={styles.ctrl}>
              <span>글씨체</span>
              <select
                value={cfg.font}
                onChange={(e) => set({ font: e.target.value as FontKey })}
              >
                {Object.entries(FONTS).map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.ctrl}>
              <span>비율</span>
              <select
                value={cfg.ratio}
                onChange={(e) => set({ ratio: e.target.value as BubbleConfig['ratio'] })}
              >
                <option value="square">정사각 1:1 (SNS)</option>
                <option value="portrait">세로 4:5</option>
              </select>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                onClick={() => set({ seed: cfg.seed + 1 })}
              >
                배치 셔플
              </button>
            </label>
          </div>

          <div className={styles.tbox}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>키워드</th>
                  <th className={styles.num}>체크</th>
                  <th className={styles.num}>비율</th>
                  <th className={styles.num}>크기</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.all.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      응답이 없습니다
                    </td>
                  </tr>
                )}
                {table.all.map((e) => {
                  const shown = table.items.find((s) => s.label === e.label);
                  const off = !shown;
                  return (
                    <tr key={e.label} className={off ? styles.rowOff : ''}>
                      <td>
                        {e.label}
                        {e.isCustom && <em className={styles.customTag}>기타</em>}
                      </td>
                      <td className={styles.num}>{e.raw}</td>
                      <td className={styles.num}>{Math.round(e.ratio * 100)}%</td>
                      <td className={styles.num}>{shown ? shown.fontSize.toFixed(0) : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.toggle}
                          onClick={() => {
                            const d = { ...cfg.disabled };
                            if (d[e.label]) delete d[e.label];
                            else d[e.label] = true;
                            set({ disabled: d });
                          }}
                        >
                          {cfg.disabled[e.label] ? '켜기' : '끄기'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.blockHint}>
            응답 {table.n}명 · 등장 키워드 {table.all.length}개 · 말풍선 표시 {table.items.length}개
          </p>
        </div>

        <div>
          <canvas ref={bubbleRef} className={styles.canvas} />
          {dropped > 0 && (
            <p className={styles.warn}>
              공간이 부족해 {dropped}개 키워드가 배치되지 못했습니다. 1표 키워드를 제외하거나 일부를
              꺼주세요.
            </p>
          )}
          <div className={styles.exports}>
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                download(bubbleRef.current, cat === 'image' ? '이미지말풍선' : '퍼스널리티말풍선')
              }
            >
              말풍선 PNG
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.ghost}`}
              onClick={confirmSnapshot}
            >
              {saved === cat ? '저장됨' : '이 설정으로 확정'}
            </button>
          </div>
          <p className={styles.note}>
            확정하면 지금 설정이 저장됩니다. 나중에 같은 그림을 그대로 다시 뽑을 수 있습니다.
          </p>
        </div>
      </div>

      <h2 className={`${styles.blockTitle} ${styles.mt}`}>내가 보는 나, 타인이 보는 나</h2>
      <p className={styles.blockHint}>
        셀프 체크는 말풍선에 넣지 않고 이 보고서로만 전달합니다.
      </p>
      <canvas ref={reportRef} className={styles.canvasWide} />
      <div className={styles.exports}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => download(reportRef.current, '내가보는나_타인이보는나')}
        >
          보고서 PNG
        </button>
      </div>
    </section>
  );
}
