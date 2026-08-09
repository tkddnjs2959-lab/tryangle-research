/**
 * 말풍선 · 보고서 렌더러.
 *
 * 로컬 툴(퍼스널리서치_말풍선툴.html)에서 검증한 로직을 그대로 옮긴 것.
 * 브라우저 canvas 를 쓰므로 클라이언트에서만 호출한다.
 * 순수 함수라 서버 의존성이 없다.
 */

export type Item = { label: string; raw: number; isCustom: boolean };

export type BubbleConfig = {
  exponent: number;                        // 강조 곡선. 클수록 최다 키워드가 도드라진다
  singleVote: 'small' | 'exclude';         // 1표 키워드 처리
  normalize: boolean;                      // 응답자별 가중치 정규화
  ratio: 'square' | 'portrait';
  seed: number;
  gap: number;                             // 키워드 간격(px)
  font: FontKey;
  disabled: Record<string, true>;
  merges: Record<string, string>;
};

export const defaultConfig = (): BubbleConfig => ({
  exponent: 1.2,
  singleVote: 'small',
  normalize: false,
  ratio: 'square',
  seed: 1,
  gap: 2,
  font: 'jua',
  disabled: {},
  merges: {},
});

const BASE_FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

export type FontKey = 'jua' | 'gowun' | 'gaegu' | 'pen' | 'system';

export const FONTS: Record<FontKey, { label: string; css: string; weight: number }> = {
  jua: { label: '주아 — 둥글둥글 · 기본', css: `"Jua",${BASE_FONT}`, weight: 400 },
  gowun: { label: '고운돋움 — 부드러운 고딕', css: `"Gowun Dodum",${BASE_FONT}`, weight: 400 },
  gaegu: { label: '개구 — 동글한 손글씨', css: `"Gaegu",${BASE_FONT}`, weight: 700 },
  pen: { label: '나눔펜 — 손글씨', css: `"Nanum Pen Script",${BASE_FONT}`, weight: 400 },
  system: { label: '시스템 기본 고딕', css: BASE_FONT, weight: 700 },
};

const FONT_MIN = 15;
const FONT_MAX = 92;

export const PALETTE = {
  image: ['#0D1C46', '#1B3070', '#2B4593', '#4A63AD', '#7285C2', '#9FADD2'],
  personality: ['#3F2A0F', '#65471B', '#8A6529', '#A98548', '#C2A377', '#D6C2A2'],
} as const;

const FAINT = '#B4BAC8';

// ---------------------------------------------------------------------
// 집계 → 크기
// ---------------------------------------------------------------------
export type Sized = Item & { score: number; ratio: number; rel: number; fontSize: number };

export function prepare(items: Item[], n: number, cfg: BubbleConfig) {
  // 병합: 커스텀 라벨을 표준 키워드로 합친다
  const merged = new Map<string, Item>();
  for (const it of items) {
    const label = cfg.merges[it.label] || it.label;
    const cur = merged.get(label);
    if (cur) cur.raw += it.raw;
    else merged.set(label, { ...it, label });
  }

  const all = [...merged.values()].map((it) => ({
    ...it,
    // 정규화는 응답자별 체크 수를 모르면 정확히 못 한다.
    // 여기서는 체크 수가 많은 키워드의 영향을 줄이는 근사치로 √를 쓴다.
    score: cfg.normalize ? Math.sqrt(it.raw) : it.raw,
    ratio: n ? it.raw / n : 0,
  }));

  all.sort((a, b) => b.raw - a.raw || a.label.localeCompare(b.label, 'ko'));

  let shown = all.filter((e) => !cfg.disabled[e.label]);
  if (cfg.singleVote === 'exclude') shown = shown.filter((e) => e.raw >= 2);

  const maxScore = shown.reduce((m, e) => Math.max(m, e.score), 0) || 1;
  const sized: Sized[] = shown.map((e) => {
    const rel = e.score / maxScore;
    return { ...e, rel, fontSize: FONT_MIN + (FONT_MAX - FONT_MIN) * Math.pow(rel, cfg.exponent) };
  });

  return { all, items: sized, n };
}

// ---------------------------------------------------------------------
// 배치
// ---------------------------------------------------------------------
const GS = 3;

let measureCtx: CanvasRenderingContext2D | null = null;
function measure() {
  if (!measureCtx) {
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d')!;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    measureCtx = c;
  }
  return measureCtx;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Geo = ReturnType<typeof geometry>;

export function geometry(ratio: 'square' | 'portrait') {
  const W = 1080;
  const H = ratio === 'portrait' ? 1350 : 1080;
  const titleH = 84;
  const footH = 64;
  const tailH = 64;
  const ry = (H - titleH - footH - tailH) / 2;
  const rx = Math.min((W - 96) / 2, ratio === 'portrait' ? 496 : 470);
  const cx = W / 2;
  const cy = titleH + ry;
  const a1 = Math.PI * 0.6;
  const a2 = Math.PI * 0.82;
  const am = (a1 + a2) / 2;
  return {
    W,
    H,
    body: { cx, cy, rx, ry },
    tail: { a1, a2, tipx: cx + rx * 1.34 * Math.cos(am), tipy: cy + ry * 1.3 * Math.sin(am) },
  };
}

function bodyPath(ctx: CanvasRenderingContext2D, b: Geo['body']) {
  ctx.beginPath();
  ctx.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function bubblePath(ctx: CanvasRenderingContext2D, g: Geo) {
  const b = g.body;
  const t = g.tail;
  ctx.beginPath();
  // 꼬리 구간(a1~a2)만 남기고 나머지 원호를 그린다
  ctx.ellipse(b.cx, b.cy, b.rx, b.ry, 0, t.a2, t.a1 + Math.PI * 2, false);
  ctx.lineTo(t.tipx, t.tipy);
  ctx.closePath();
}

function buildMask(g: Geo) {
  const cols = Math.ceil(g.W / GS);
  const rows = Math.ceil(g.H / GS);
  const cv = document.createElement('canvas');
  cv.width = g.W;
  cv.height = g.H;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000';
  bodyPath(c, g.body);
  c.fill();
  const d = c.getImageData(0, 0, g.W, g.H).data;
  const mask = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(g.W - 1, gx * GS + (GS >> 1));
      const py = Math.min(g.H - 1, gy * GS + (GS >> 1));
      mask[gy * cols + gx] = d[(py * g.W + px) * 4 + 3] > 128 ? 1 : 0;
    }
  }
  return { mask, cols, rows };
}

type Placed = { it: Sized; ax: number; ay: number; fs: number };

function tryLayout(
  items: Sized[],
  scale: number,
  g: Geo,
  mk: ReturnType<typeof buildMask>,
  rnd: () => number,
  pad: number,
  font: FontKey
) {
  const { mask, cols, rows } = mk;
  const occ = new Uint8Array(cols * rows);
  const cx = g.body.cx;
  const cy = g.body.cy;
  const placed: Placed[] = [];
  let dropped = 0;
  const wf = FONTS[font];
  const ctx = measure();

  const cellOK = (x: number, y: number) => {
    const gx = (x / GS) | 0;
    const gy = (y / GS) | 0;
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
    const i = gy * cols + gx;
    return !!mask[i] && !occ[i];
  };
  const fits = (x: number, y: number, w: number, h: number) => {
    const x0 = ((x - w / 2 - pad) / GS) | 0;
    const x1 = ((x + w / 2 + pad) / GS) | 0;
    const y0 = ((y - h / 2 - pad) / GS) | 0;
    const y1 = ((y + h / 2 + pad) / GS) | 0;
    if (x0 < 0 || y0 < 0 || x1 >= cols || y1 >= rows) return false;
    for (let gy = y0; gy <= y1; gy++) {
      const base = gy * cols;
      for (let gx = x0; gx <= x1; gx++) {
        const i = base + gx;
        if (!mask[i] || occ[i]) return false;
      }
    }
    return true;
  };
  const mark = (x: number, y: number, w: number, h: number) => {
    const x0 = Math.max(0, ((x - w / 2 - pad) / GS) | 0);
    const x1 = Math.min(cols - 1, ((x + w / 2 + pad) / GS) | 0);
    const y0 = Math.max(0, ((y - h / 2 - pad) / GS) | 0);
    const y1 = Math.min(rows - 1, ((y + h / 2 + pad) / GS) | 0);
    for (let gy = y0; gy <= y1; gy++) {
      const base = gy * cols;
      for (let gx = x0; gx <= x1; gx++) occ[base + gx] = 1;
    }
  };

  for (const it of items) {
    const fs = it.fontSize * scale;
    ctx.font = `${wf.weight} ${fs}px ${wf.css}`;
    const m = ctx.measureText(it.label);
    // 폰트 상자가 아니라 글자 실제 외곽 기준으로 재야 촘촘하게 붙는다
    const L = m.actualBoundingBoxLeft ?? m.width / 2;
    const R = m.actualBoundingBoxRight ?? m.width / 2;
    const A = m.actualBoundingBoxAscent ?? fs * 0.76;
    const D = m.actualBoundingBoxDescent ?? fs * 0.2;
    const w = L + R + fs * 0.04;
    const h = A + D + fs * 0.04;
    const ox = (L - R) / 2;
    const oy = (A - D) / 2;

    const a0 = rnd() * Math.PI * 2;
    let done = false;
    for (let t = 0; t < 300; t += 0.09) {
      const r = t * 2.0;
      const a = a0 + t;
      const x = cx + r * Math.cos(a) * 1.22;
      const y = cy + r * Math.sin(a) * 0.92;
      if (!cellOK(x, y)) continue;
      if (
        !cellOK(x - w / 2, y - h / 2) ||
        !cellOK(x + w / 2, y - h / 2) ||
        !cellOK(x - w / 2, y + h / 2) ||
        !cellOK(x + w / 2, y + h / 2)
      )
        continue;
      if (!fits(x, y, w, h)) continue;
      mark(x, y, w, h);
      placed.push({ it, ax: x + ox, ay: y + oy, fs });
      done = true;
      break;
    }
    if (!done) dropped++;
  }
  return { placed, dropped };
}

/** 말풍선을 꽉 채우는 최대 배율을 이분 탐색으로 찾는다 */
function layout(items: Sized[], g: Geo, seed: number, pad: number, font: FontKey) {
  if (!items.length) return { placed: [] as Placed[], dropped: 0, scale: 1 };
  const mk = buildMask(g);
  let lo = 0.3;
  let hi = 3.2;
  let best: { placed: Placed[]; dropped: number; scale: number } | null = null;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const res = tryLayout(items, mid, g, mk, mulberry32(seed * 7919 + i), pad, font);
    if (res.dropped === 0) {
      best = { ...res, scale: mid };
      lo = mid;
    } else hi = mid;
  }
  if (!best) {
    const res = tryLayout(items, 0.3, g, mk, mulberry32(seed * 7919), pad, font);
    best = { ...res, scale: 0.3 };
  }
  return best;
}

function colorOf(cat: 'image' | 'personality', it: Sized) {
  if (it.raw <= 1) return FAINT;
  const pal = PALETTE[cat];
  const idx = Math.min(pal.length - 1, Math.floor((1 - it.rel) * pal.length));
  return pal[idx];
}

export function drawBubble(
  canvas: HTMLCanvasElement,
  opts: {
    cat: 'image' | 'personality';
    actorName: string;
    items: Item[];
    n: number;
    cfg: BubbleConfig;
    scale?: number;
  }
) {
  const { cat, actorName, cfg } = opts;
  const g = geometry(cfg.ratio);
  const S = opts.scale ?? 2;
  canvas.width = g.W * S;
  canvas.height = g.H * S;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, g.W, g.H);

  const { items } = prepare(opts.items, opts.n, cfg);
  const res = layout(items, g, cfg.seed, cfg.gap, cfg.font);
  const wf = FONTS[cfg.font];

  bubblePath(ctx, g);
  ctx.fillStyle = '#FCFDFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE[cat][1];
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE[cat][0];
  ctx.font = `${wf.weight === 400 ? 400 : 800} 32px ${wf.css}`;
  ctx.fillText(actorName || '배우', g.W / 2, 42);
  ctx.fillStyle = '#9AA1B2';
  ctx.font = `600 16px ${BASE_FONT}`;
  ctx.fillText(
    `${cat === 'image' ? '이미지' : '퍼스널리티'} RESEARCH · 응답 ${opts.n}명`,
    g.W / 2,
    68
  );

  for (const p of res.placed) {
    ctx.font = `${wf.weight} ${p.fs}px ${wf.css}`;
    ctx.fillStyle = colorOf(cat, p.it);
    ctx.fillText(p.it.label, p.ax, p.ay);
  }

  if (!items.length) {
    ctx.fillStyle = '#AAB1C2';
    ctx.font = `600 24px ${BASE_FONT}`;
    ctx.fillText('응답이 아직 없습니다', g.body.cx, g.body.cy);
  }

  ctx.fillStyle = '#B7BDCA';
  ctx.font = `600 15px ${BASE_FONT}`;
  ctx.fillText('ⓒ Artist Branding Company TRY앵글', g.W / 2, g.H - 24);

  return res;
}

// ---------------------------------------------------------------------
// 보고서 — 내가 보는 나, 타인이 보는 나
// ---------------------------------------------------------------------
export const GAP_HIGH = 0.35;
export const GAP_LOW = 0.15;

const RPT = { ink: '#141A21', sub: '#8B98A4', line: '#CFE5F5', none: '#B9C6D0' };

const GAP_GROUPS: [string, string, string, string][] = [
  ['일치', '내 생각대로 보이고 있는 부분', '#E4F1FA', '#C6E1F4'],
  ['부분 일치', '약하게만 전달되는 부분', '#F1F8FD', '#DEEDF8'],
  ['나만 아는 나', '타인에게 거의 닿지 않는 부분', '#FAFDFE', '#E7F1F8'],
  ['몰랐던 나', '체크하지 않았는데 타인이 강하게 본 부분', '#D5E9F8', '#AFD3EE'],
];

type Chip = { label: string; cnt: string };

export type ReportInput = {
  actorName: string;
  birthYear: number | null;
  image: { items: Item[]; n: number; self: string[] };
  personality: { items: Item[]; n: number; self: string[] };
};

function gapData(items: Item[], n: number, self: string[]) {
  const ratioOf = (l: string) => {
    const it = items.find((e) => e.label === l);
    return it && n ? it.raw / n : 0;
  };
  const rawOf = (l: string) => items.find((e) => e.label === l)?.raw ?? 0;
  const chip = (l: string): Chip => ({ label: l, cnt: `${rawOf(l)} / ${n}` });

  return {
    n,
    groups: [
      self.filter((l) => ratioOf(l) >= GAP_HIGH).map(chip),
      self.filter((l) => ratioOf(l) >= GAP_LOW && ratioOf(l) < GAP_HIGH).map(chip),
      self.filter((l) => ratioOf(l) < GAP_LOW).map(chip),
      items
        .filter((e) => !self.includes(e.label) && n && e.raw / n >= GAP_HIGH)
        .map((e) => ({ label: e.label, cnt: `${e.raw} / ${n}` })),
    ],
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const CHIP_H = 56;
const CHIP_R = 28;
const CHIP_PX = 24;
const CHIP_GAPX = 11;
const CHIP_ROW = 70;

function drawChips(
  ctx: CanvasRenderingContext2D,
  list: Chip[],
  x: number,
  y: number,
  maxW: number,
  bg: string,
  bd: string
) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (!list.length) {
    ctx.font = `500 22px ${BASE_FONT}`;
    ctx.fillStyle = RPT.none;
    ctx.fillText('해당 없음', x, y + CHIP_H / 2);
    return y + CHIP_H;
  }
  let cx = x;
  let cy = y;
  for (const it of list) {
    ctx.font = `600 28px ${BASE_FONT}`;
    const lw = ctx.measureText(it.label).width;
    ctx.font = `600 19px ${BASE_FONT}`;
    const cw = ctx.measureText(it.cnt).width;
    const w = CHIP_PX * 2 + lw + 13 + cw;
    if (cx + w > x + maxW && cx > x) {
      cx = x;
      cy += CHIP_ROW;
    }
    roundRect(ctx, cx, cy, w, CHIP_H, CHIP_R);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = bd;
    ctx.stroke();

    ctx.font = `600 28px ${BASE_FONT}`;
    ctx.fillStyle = RPT.ink;
    ctx.fillText(it.label, cx + CHIP_PX, cy + CHIP_H / 2 + 1);
    ctx.font = `600 19px ${BASE_FONT}`;
    ctx.fillStyle = RPT.sub;
    ctx.fillText(it.cnt, cx + CHIP_PX + lw + 13, cy + CHIP_H / 2 + 2);

    cx += w + CHIP_GAPX;
  }
  return cy + CHIP_H;
}

function renderReport(ctx: CanvasRenderingContext2D, W: number, input: ReportInput) {
  const M = 76;
  const maxW = W - M * 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const who = [input.actorName, input.birthYear && `${input.birthYear}년생`]
    .filter(Boolean)
    .join(' · ');
  if (who) {
    ctx.fillStyle = RPT.sub;
    ctx.font = `600 19px ${BASE_FONT}`;
    ctx.fillText(who, M, 74);
  }
  ctx.fillStyle = RPT.ink;
  ctx.font = `700 42px ${BASE_FONT}`;
  ctx.fillText('내가 보는 나, 타인이 보는 나', M, who ? 124 : 104);

  let y = who ? 208 : 188;

  const blocks: [string, ReturnType<typeof gapData>, number][] = [
    ['이미지 리서치', gapData(input.image.items, input.image.n, input.image.self), input.image.self.length],
    [
      '퍼스널리티 리서치',
      gapData(input.personality.items, input.personality.n, input.personality.self),
      input.personality.self.length,
    ],
  ];

  blocks.forEach(([title, d, selfCount], bi) => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = RPT.ink;
    ctx.font = `700 29px ${BASE_FONT}`;
    ctx.fillText(title, M, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = RPT.sub;
    ctx.font = `600 18px ${BASE_FONT}`;
    ctx.fillText(`응답 ${d.n}명 · 셀프 체크 ${selfCount}개`, W - M, y);
    ctx.textAlign = 'left';

    y += 20;
    ctx.strokeStyle = RPT.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();
    y += 52;

    GAP_GROUPS.forEach(([label, desc, bg, bd], gi) => {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = RPT.ink;
      ctx.font = `700 22px ${BASE_FONT}`;
      ctx.fillText(label, M, y);
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = RPT.sub;
      ctx.font = `500 19px ${BASE_FONT}`;
      ctx.fillText(desc, M + tw + 14, y);
      y += 32;
      y = drawChips(ctx, d.groups[gi], M, y, maxW, bg, bd);
      if (gi < GAP_GROUPS.length - 1) y += 54;
    });

    if (bi === 0) y += 96;
  });

  return y;
}

export function drawReport(canvas: HTMLCanvasElement, input: ReportInput, scale = 2) {
  const W = 1080;
  // 1차: 내용 높이 측정
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = 6000;
  const bottom = renderReport(tmp.getContext('2d')!, W, input);
  const H = Math.max(900, Math.round(bottom + 110));

  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  renderReport(ctx, W, input);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = RPT.sub;
  ctx.globalAlpha = 0.7;
  ctx.font = `600 15px ${BASE_FONT}`;
  ctx.fillText('ⓒ Artist Branding Company TRY앵글', W / 2, H - 40);
  ctx.globalAlpha = 1;
}

export async function loadFont(key: FontKey) {
  const f = FONTS[key];
  const fam = f.css.split(',')[0];
  try {
    await document.fonts.load(`${f.weight} 120px ${fam}`);
    await document.fonts.ready;
  } catch {
    /* 웹폰트를 못 받아도 시스템 폰트로 렌더된다 */
  }
}
