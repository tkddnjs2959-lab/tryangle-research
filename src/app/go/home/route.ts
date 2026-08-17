import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const destination = 'https://tryangle-official.co.kr/';
const clean = (value: string | null, fallback: string, max: number) => value?.trim().slice(0, max) || fallback;
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const attribution = {
    destination: 'homepage',
    source: clean(url.searchParams.get('utm_source'), 'unknown', 100),
    medium: clean(url.searchParams.get('utm_medium'), 'unknown', 100),
    campaign: clean(url.searchParams.get('utm_campaign'), 'unknown', 150),
    content: clean(url.searchParams.get('utm_content'), 'homepage', 150),
  };
  try {
    const { error } = await db().from('marketing_link_clicks').insert(attribution);
    if (error) throw error;
  } catch (error) {
    console.error('homepage link click logging failed', error);
  }
  // 홈페이지에서도 Clarity·GA4가 동일한 캠페인을 인식하도록 UTM을 전달한다.
  const redirectUrl = new URL(destination);
  for (const key of attributionKeys) {
    const value = url.searchParams.get(key);
    if (value) redirectUrl.searchParams.set(key, value.slice(0, 150));
  }
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
