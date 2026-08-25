import { NextResponse } from 'next/server';
import { purgeExpiredConsultationTranscripts } from '@/lib/admin-data';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const count = await purgeExpiredConsultationTranscripts();
  if (count > 0) {
    await audit({ action: 'consultation_transcript_purge', targetType: 'consultation_retention', summary: `보관기한이 지난 상담 원문 ${count}건을 자동 삭제했습니다.`, detail: { count } });
  }
  return NextResponse.json({ ok: true, purged: count }, { headers: { 'Cache-Control': 'no-store' } });
}
