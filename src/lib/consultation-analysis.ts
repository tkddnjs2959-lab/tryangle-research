import 'server-only';
import { createHash } from 'node:crypto';
import { requestDeepSeek } from './deepseek';

export const ANALYSIS_FIELDS = [
  'summary','consultation_purpose','current_concerns','goals','strengths','barriers',
  'external_image_observations','internal_image_observations','character_position_hypotheses',
  'profile_strategy','acting_material_recommendations','agreed_actions','follow_up_questions',
  'risk_flags','evidence',
] as const;

const SYSTEM = `너는 배우 상담 기록을 정리하는 내부 분석 보조 도구다.
상담 원문을 근거로만 분석하고 원문에 없는 사실을 만들지 마라.
심리 진단, 의료 진단, 법률 판단을 하지 마라.
분석 결과는 담당자가 검수해야 하는 초안이다.
각 주장에는 가능한 경우 원문 근거를 연결해라.
반드시 JSON 형식으로만 응답해라.`;

function mask(text: string, actorName: string) {
  const masked = text
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, '[전화번호]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[이메일]')
    .replace(/\b\d{6}-?[1-4]\d{6}\b/g, '[주민번호]')
    .replace(/(?:카카오|kakao)[\s_-]*(?:id|아이디)?\s*[:：]?\s*[\w-]+/gi, '[카카오ID]')
    .replace(/(?:계좌(?:번호)?|은행)\s*[:：]?\s*[\d-]{8,}/g, '[계좌정보]')
    .replace(/(?:주소|거주지)\s*[:：]\s*[^\n]+/g, '[주소]');
  return actorName ? masked.split(actorName).join('ACTOR_001') : masked;
}

function valid(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI 결과가 객체가 아닙니다.');
  const result = value as Record<string, unknown>;
  for (const key of ANALYSIS_FIELDS) {
    if (key === 'summary' || key === 'consultation_purpose') {
      if (typeof result[key] !== 'string') result[key] = '';
    } else if (key === 'evidence') {
      if (!Array.isArray(result[key])) result[key] = [];
    } else if (!Array.isArray(result[key])) result[key] = [];
  }
  return result;
}

export async function analyzeConsultation(input: { text: string; actorName: string }) {
  const safeText = mask(input.text, input.actorName);
  const hash = createHash('sha256').update(safeText).digest('hex');
  if (process.env.DEEPSEEK_ANALYSIS_ENABLED === 'false') return { configured: false as const, hash };
  const response = await requestDeepSeek({
    system: SYSTEM,
    user: `다음 상담 원문을 분석해라. 결과 키는 summary, consultation_purpose, current_concerns, goals, strengths, barriers, external_image_observations, internal_image_observations, character_position_hypotheses, profile_strategy, acting_material_recommendations, agreed_actions, follow_up_questions, risk_flags, evidence를 사용해라.\n\n${safeText}`,
  });
  if (!response.configured) return { configured: false as const, hash };
  let parsed: unknown;
  try { parsed = JSON.parse(response.content); } catch { throw new Error('DeepSeek가 올바른 JSON을 반환하지 않았습니다.'); }
  const structured = valid(parsed);
  return { configured: true as const, hash, structured, usage: response.usage };
}
