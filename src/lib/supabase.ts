import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 서버 전용 Supabase 클라이언트.
 *
 * service_role 키는 RLS 를 우회하는 마스터 키다.
 * 'server-only' 를 import 했으므로 클라이언트 컴포넌트에서 이 파일을
 * import 하면 빌드가 실패한다 — 실수로 브라우저에 키가 나가는 것을 막는다.
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다. ' +
        '.env.local.example 을 참고해 .env.local 을 만드세요.'
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
