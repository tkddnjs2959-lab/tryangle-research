import { NextRequest, NextResponse } from 'next/server';
import { unlinkActorFromKakaoUserId } from '@/lib/actor-account';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  const primaryKey = process.env.KAKAO_PRIMARY_ADMIN_KEY;
  return Boolean(primaryKey) && req.headers.get('authorization') === `KakaoAK ${primaryKey}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    console.warn('카카오 연결 해제 웹훅 인증 실패');
    return new NextResponse(null, { status: 200 });
  }

  const values = req.method === 'GET'
    ? req.nextUrl.searchParams
    : new URLSearchParams(await req.text());
  const appId = values.get('app_id');
  const userId = values.get('user_id');
  const expectedAppId = process.env.KAKAO_APP_ID;
  if (!appId || !userId || (expectedAppId && appId !== expectedAppId)) {
    console.warn('카카오 연결 해제 웹훅 파라미터 확인 실패', { appId, hasUserId: Boolean(userId) });
    return new NextResponse(null, { status: 200 });
  }

  try {
    const actorId = await unlinkActorFromKakaoUserId(userId);
    if (actorId) {
      await audit({
        action: 'kakao_unlink',
        targetType: 'actor',
        targetId: actorId,
        summary: '카카오 외부 연결 해제를 반영했습니다.',
        detail: { operation: 'unlink_webhook', referrerType: values.get('referrer_type') },
      });
    }
  } catch (error) {
    console.error('카카오 연결 해제 웹훅 처리 실패', error);
  }
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
