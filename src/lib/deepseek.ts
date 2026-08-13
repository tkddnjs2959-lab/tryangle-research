import 'server-only';

const ENDPOINT = 'https://api.deepseek.com/chat/completions';

export async function requestDeepSeek(input: { system: string; user: string }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { configured: false as const };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('DeepSeek 응답에 JSON 내용이 없습니다.');
    return { configured: true as const, content, usage: json.usage ?? null };
  } finally {
    clearTimeout(timer);
  }
}
