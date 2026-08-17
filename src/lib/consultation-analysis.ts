import 'server-only';
import { createHash } from 'node:crypto';
import { getConsultationForAnalysis, saveConsultationAnalysis } from './admin-data';

const PROMPT_VERSION = 'consultation-v1-gemini';
const MODEL = process.env.GEMINI_CONSULTATION_MODEL || 'gemini-3.5-flash-lite';

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    consultation_goal: { type: 'string' },
    participant_type: { type: 'string', enum: ['inquiry', 'student', 'actor', 'unknown'] },
    needs: { type: 'array', items: { type: 'string' } },
    pain_points: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    barriers: { type: 'array', items: { type: 'string' } },
    recommended_program: { type: 'string' },
    conversion_signal: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
    risk_flags: { type: 'array', items: { type: 'string' } },
    next_actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          assignee: { type: 'string' },
          due_date: { type: 'string' },
        },
        required: ['title', 'description', 'assignee', 'due_date'],
      },
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: { quote: { type: 'string' }, reason: { type: 'string' } },
        required: ['quote', 'reason'],
      },
    },
  },
  required: [
    'summary', 'consultation_goal', 'participant_type', 'needs', 'pain_points', 'strengths',
    'barriers', 'recommended_program', 'conversion_signal', 'risk_flags', 'next_actions', 'evidence',
  ],
} as const;

export async function analyzeConsultation(sessionId: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const { session, transcript } = await getConsultationForAnalysis(sessionId);
  if (!session.consent_obtained_at) throw new Error('Consultation analysis consent is required.');
  const fullText = String(transcript?.full_text ?? '').trim();
  if (!fullText) throw new Error('The consultation transcript is empty.');
  if (fullText.length > 200_000) throw new Error('The consultation transcript is too long.');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You analyze TRYANGLE consultation transcripts. Do not infer facts not present in the transcript. Use unknown or empty arrays when uncertain. Do not extract or enrich personal information. Respond in Korean.' }],
        },
        contents: [{
          role: 'user',
          parts: [{ text: `Analyze the following consultation transcript and return the requested JSON structure. This is for consultation operations only, not diagnosis or admissions decisions.\n\n[TRANSCRIPT]\n${fullText}` }],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_SCHEMA,
        },
      }),
    },
  );

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: unknown;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || `Gemini analysis API error (${response.status})`);
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('The analysis response was empty.');

  const structuredResult = JSON.parse(content) as { summary?: string };
  const inputHash = createHash('sha256').update(fullText).digest('hex');
  return saveConsultationAnalysis({
    sessionId,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    summary: String(structuredResult.summary ?? ''),
    structuredResult,
    inputHash,
    tokenUsage: payload.usageMetadata ?? null,
  });
}
