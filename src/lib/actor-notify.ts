import 'server-only';
import { refreshKakaoAccessToken, sendKakaoMemo } from './kakao-login';
import { db } from './supabase';
import { weekLabel } from './weeks';

/**
 * 주차를 열었을 때 배우에게 카카오톡으로 알린다.
 *
 * 배우 본인의 토큰으로 '나에게 보내기' 를 호출하므로 배우의 '나와의 채팅' 에
 * 메시지가 뜬다. 알림톡과 달리 건당 비용이 없다.
 *
 * 보낼 수 있는 조건 — 하나라도 빠지면 그 배우는 조용히 건너뛴다.
 *   1. 배우가 카카오 로그인을 했고
 *   2. 그때 talk_message 동의를 받아 refresh_token 이 저장돼 있고
 *      (KAKAO_ACTOR_SCOPES 를 켜기 전에 로그인한 배우는 토큰이 없다)
 *   3. notify_enabled 가 켜져 있고
 *   4. 그 주차를 아직 알리지 않았다
 *
 * **알림 실패가 주차 공개를 막으면 안 된다.** 공개는 이미 DB 에 반영된
 * 사실이고 알림은 부가 기능이라, 여기서는 예외를 밖으로 던지지 않는다.
 */

export type NotifyResult = {
  sent: number;
  skipped: number;
  failed: number;
};

type Row = {
  actor_id: string;
  kakao_refresh_token: string | null;
  notify_enabled: boolean;
  notified_weeks: number[] | null;
};

function progressUrl(progressToken: string): string | null {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}/s/${progressToken}` : null;
}

export async function notifyActorsWeekOpen(input: {
  actorIds: string[];
  week: number;
  title: string | null;
}): Promise<NotifyResult> {
  const result: NotifyResult = { sent: 0, skipped: 0, failed: 0 };
  if (input.actorIds.length === 0) return result;

  const supabase = db();

  const { data: accounts, error } = await supabase
    .from('actor_accounts')
    .select('actor_id, kakao_refresh_token, notify_enabled, notified_weeks')
    .in('actor_id', input.actorIds);

  if (error) {
    console.error('배우 알림 대상 조회 실패', error.message);
    return { sent: 0, skipped: input.actorIds.length, failed: 0 };
  }

  const byActor = new Map((accounts ?? []).map((r) => [r.actor_id as string, r as Row]));

  // 링크를 넣으려면 배우별 진행 현황 토큰이 필요하다.
  const { data: actors } = await supabase
    .from('actors')
    .select('id, name, progress_token')
    .in('id', input.actorIds);
  const actorById = new Map((actors ?? []).map((a) => [a.id as string, a]));

  for (const actorId of input.actorIds) {
    const acc = byActor.get(actorId);
    const actor = actorById.get(actorId);

    if (!acc?.kakao_refresh_token || !acc.notify_enabled || !actor) {
      result.skipped += 1;
      continue;
    }
    if ((acc.notified_weeks ?? []).includes(input.week)) {
      result.skipped += 1;
      continue;
    }

    try {
      const refreshed = await refreshKakaoAccessToken(acc.kakao_refresh_token);
      if (!refreshed) {
        result.failed += 1;
        continue;
      }

      const link = progressUrl(actor.progress_token as string);
      const ok = await sendKakaoMemo({
        accessToken: refreshed.accessToken,
        text:
          `[TRY앵글] ${weekLabel(input.week, input.title)} 공개\n\n` +
          `${actor.name} 님, ${input.week}주차 내용이 공개되었습니다.\n` +
          (link ? '아래 링크에서 진행 현황을 확인해주세요.' : '담당자가 안내드릴 예정입니다.'),
        linkUrl: link,
      });

      if (!ok) {
        result.failed += 1;
        continue;
      }

      // 카카오가 refresh_token 을 회전시켜 줬으면 저장하고,
      // 같은 주차를 다시 알리지 않도록 기록한다.
      const patch: Record<string, unknown> = {
        notified_weeks: [...(acc.notified_weeks ?? []), input.week],
        updated_at: new Date().toISOString(),
      };
      if (refreshed.refreshToken) {
        patch.kakao_refresh_token = refreshed.refreshToken;
        if (refreshed.refreshTokenExpiresIn) {
          patch.kakao_refresh_expires_at = new Date(
            Date.now() + refreshed.refreshTokenExpiresIn * 1000
          ).toISOString();
        }
      }
      await supabase.from('actor_accounts').update(patch).eq('actor_id', actorId);

      result.sent += 1;
    } catch (err) {
      console.error('배우 알림 처리 중 오류', actorId, err);
      result.failed += 1;
    }
  }

  return result;
}

/** 기수 전체 공개용 — 그 기수에서 아직 보관되지 않은 배우 id 를 모은다. */
export async function listActorIdsInCohort(cohort: string): Promise<string[]> {
  const { data, error } = await db()
    .from('actors')
    .select('id')
    .eq('cohort', cohort)
    .neq('status', 'archived');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}
