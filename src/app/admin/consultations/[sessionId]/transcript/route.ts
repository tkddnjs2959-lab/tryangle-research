import { NextResponse } from 'next/server';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { getConsultationSession } from '@/lib/admin-data';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const identity = await currentAdminIdentity();
  if (!identity) return new NextResponse('Unauthorized', { status: 401 });
  if (identity.role === 'viewer') return new NextResponse('Forbidden', { status: 403 });
  const { sessionId } = await context.params;
  const session = await getConsultationSession(sessionId);
  if (!session?.transcript?.fullText) return new NextResponse('상담 원문이 없거나 삭제되었습니다.', { status: 404 });

  await audit({
    action: 'consultation_transcript_view',
    targetType: 'consultation_session',
    targetId: sessionId,
    summary: '상담 원문을 열람했습니다.',
  });

  return new NextResponse(session.transcript.fullText, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
