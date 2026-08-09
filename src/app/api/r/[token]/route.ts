import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { SUBMIT_ERRORS } from '@/lib/research';
import { TOKEN_RE } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_KEYWORDS = 60;   // 이미지 48 / 퍼스널리티 63 이므로 셀프도 여유 있게
const MAX_CUSTOM = 5;
const MAX_CUSTOM_LEN = 20;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // 토큰 형식부터 확인한다. 이상한 값으로 DB 를 두드리지 않는다.
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ message: '존재하지 않는 링크입니다.' }, { status: 404 });
  }

  // 이 브라우저에서 이미 제출했는지.
  // IP+UA 해시로 막으면 같은 집 WiFi 를 쓰는 가족이 서로를 막아버린다.
  // 쿠키는 사람 단위에 가장 가깝고 오탐이 없다.
  const jar = await cookies();
  if (jar.get(`done_${token}`)?.value === '1') {
    return NextResponse.json({ message: '이미 참여해주셨습니다.' }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 400 });
  }

  const raw = body as { keywordIds?: unknown; custom?: unknown };

  const keywordIds = Array.isArray(raw.keywordIds)
    ? [...new Set(raw.keywordIds.filter((v): v is number => Number.isInteger(v)))].slice(
        0,
        MAX_KEYWORDS
      )
    : [];

  const custom = Array.isArray(raw.custom)
    ? [
        ...new Set(
          raw.custom
            .filter((v): v is string => typeof v === 'string')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && s.length <= MAX_CUSTOM_LEN)
        ),
      ].slice(0, MAX_CUSTOM)
    : [];

  if (keywordIds.length + custom.length === 0) {
    return NextResponse.json(
      { message: '키워드를 하나 이상 선택해주세요.' },
      { status: 400 }
    );
  }

  // 어드민이 의심 사례를 눈으로 확인하는 용도. 원본은 저장하지 않는다.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const ua = req.headers.get('user-agent') ?? '';
  const deviceHash = createHash('sha256').update(`${token}|${ip}|${ua}`).digest('hex').slice(0, 32);

  const { error } = await db().rpc('submit_response', {
    p_token: token,
    p_keyword_ids: keywordIds,
    p_custom: custom,
    p_device_hash: deviceHash,
  });

  if (error) {
    // DB 함수가 올린 코드를 그대로 사람 문구로 바꾼다
    const known = Object.keys(SUBMIT_ERRORS).find((k) => error.message?.includes(k));
    if (known) {
      const { status, message } = SUBMIT_ERRORS[known];
      return NextResponse.json({ message }, { status });
    }
    console.error('submit_response 실패', error);
    return NextResponse.json(
      { message: '제출에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`done_${token}`, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // 180일
  });
  return res;
}
