import 'server-only';
import { db } from './supabase';

/**
 * 어드민 변경 이력.
 *
 * 되돌리기 어려운 동작이 언제 무엇에 일어났는지 남긴다.
 * 어드민 계정이 하나뿐이라 '누가' 는 아직 남기지 않는다 — 계정을 나누면
 * 그때 컬럼을 추가한다.
 *
 * **기록 실패가 본 작업을 막으면 안 된다.** 로그를 남기려다 주차 공개가
 * 실패하면 본말전도라, 여기서는 예외를 던지지 않고 콘솔에만 남긴다.
 */

export type AuditAction =
  | 'week_open'
  | 'week_close'
  | 'week_override'
  | 'response_delete'
  | 'response_restore'
  | 'coaching_link'
  | 'coaching_unlink'
  | 'actor_create'
  | 'consultation_import'
  | 'legacy_import_staging';

export type AuditEntry = {
  id: number;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  createdAt: string;
};

export async function audit(input: {
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  summary: string;
  detail?: unknown;
}): Promise<void> {
  try {
    const { error } = await db().from('admin_audit_log').insert({
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      summary: input.summary,
      detail: input.detail ?? null,
    });
    if (error) console.error('변경 이력 기록 실패', error.message);
  } catch (err) {
    console.error('변경 이력 기록 중 오류', err);
  }
}

export async function listAudit(limit = 30): Promise<AuditEntry[]> {
  const { data, error } = await db()
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('변경 이력 조회 실패', error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as number,
    action: r.action as AuditAction,
    targetType: r.target_type as string | null,
    targetId: r.target_id as string | null,
    summary: r.summary as string,
    createdAt: r.created_at as string,
  }));
}

/** 특정 대상(배우 등)의 이력만 */
export async function listAuditFor(
  targetType: string,
  targetId: string,
  limit = 10
): Promise<AuditEntry[]> {
  const { data, error } = await db()
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, summary, created_at')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('변경 이력 조회 실패', error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as number,
    action: r.action as AuditAction,
    targetType: r.target_type as string | null,
    targetId: r.target_id as string | null,
    summary: r.summary as string,
    createdAt: r.created_at as string,
  }));
}
