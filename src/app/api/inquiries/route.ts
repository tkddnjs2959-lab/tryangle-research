import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { inquiryRateLimited } from '@/lib/inquiry-rate-limit';

export const dynamic = 'force-dynamic';

type InquiryPayload = {
  name?: unknown;
  contact?: unknown;
  message?: unknown;
  website?: unknown;
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  content?: unknown;
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const capped = (value: unknown, max: number, fallback: string) => text(value).slice(0, max) || fallback;

export async function POST(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  if (inquiryRateLimited(ip)) return NextResponse.json({ message: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  let body: InquiryPayload;
  try { body = await req.json() as InquiryPayload; } catch { return NextResponse.json({ message: '요청 형식이 올바르지 않습니다.' }, { status: 400 }); }

  // 봇이 채우는 숨은 필드. 정상 사용자는 이 값을 전송하지 않는다.
  if (text(body.website)) return NextResponse.json({ ok: true });

  const name = text(body.name);
  const contact = text(body.contact);
  const message = text(body.message);
  if (!name || !contact) return NextResponse.json({ message: '이름과 연락처를 입력해주세요.' }, { status: 400 });
  if (name.length > 40 || contact.length > 60 || message.length > 1000) {
    return NextResponse.json({ message: '입력 내용이 너무 깁니다. 상담 내용을 줄여주세요.' }, { status: 400 });
  }

  try {
    const { data, error } = await db().rpc('submit_inquiry', {
      p_name: name,
      p_contact: contact,
      p_message: message || null,
      p_source: capped(body.source, 100, 'website'),
      p_medium: capped(body.medium, 100, 'unknown'),
      p_campaign: capped(body.campaign, 150, 'unknown'),
      p_content: capped(body.content, 150, 'unknown'),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data });
  } catch (error) {
    console.error('inquiry submission failed', error);
    return NextResponse.json({ message: '문의가 저장되지 않았습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
