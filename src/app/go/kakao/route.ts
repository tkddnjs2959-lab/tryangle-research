import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const destination = 'http://pf.kakao.com/_mWxcMb/chat';
const clean = (value: string | null, fallback: string, max: number) => (value?.trim().slice(0, max) || fallback);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const attribution = {
    destination: 'kakao',
    source: clean(url.searchParams.get('utm_source'), 'unknown', 100),
    medium: clean(url.searchParams.get('utm_medium'), 'unknown', 100),
    campaign: clean(url.searchParams.get('utm_campaign'), 'unknown', 150),
    content: clean(url.searchParams.get('utm_content'), 'kakao', 150),
  };
  try {
    const { error } = await db().from('marketing_link_clicks').insert(attribution);
    if (error) throw error;
  } catch (error) {
    // 이동 자체는 분석 테이블 장애와 무관하게 계속되어야 한다.
    console.error('marketing link click logging failed', error);
  }
  return NextResponse.redirect(destination, { status: 302 });
}
