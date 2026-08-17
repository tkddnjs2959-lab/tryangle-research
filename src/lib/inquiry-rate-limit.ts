import 'server-only';

const WINDOW_MS = 60_000;
const LIMIT = 5;
const attempts = new Map<string, number[]>();

/** 서버 인스턴스 단위의 1차 방어선. 영속형 제한은 운영 트래픽 확인 후 Redis로 교체한다. */
export function inquiryRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= LIMIT) { attempts.set(key, recent); return true; }
  recent.push(now); attempts.set(key, recent);
  if (attempts.size > 5000) {
    for (const [entry, times] of attempts) if (times.every((time) => now - time >= WINDOW_MS)) attempts.delete(entry);
  }
  return false;
}
