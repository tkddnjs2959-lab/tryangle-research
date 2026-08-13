import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/admin-auth';
import { listInquiries } from '@/lib/admin-data';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!(await isLoggedIn())) return new NextResponse('Unauthorized', { status: 401 });

  const daysParam = new URL(request.url).searchParams.get('days');
  const days = daysParam === '7' || daysParam === '30' ? Number(daysParam) : null;
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
  const inquiries = (await listInquiries()).filter(
    (inquiry) => !cutoff || new Date(inquiry.createdAt).getTime() >= cutoff,
  );

  const header = ['created_at', 'name', 'contact', 'source', 'medium', 'campaign', 'content', 'status', 'message'];
  const rows = inquiries.map((inquiry) => [
    inquiry.createdAt,
    inquiry.name,
    inquiry.contact,
    inquiry.source,
    inquiry.medium,
    inquiry.campaign,
    inquiry.content,
    inquiry.status,
    inquiry.message,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const suffix = days ? `-${days}d` : '-all';
  await audit({
    action: 'inquiry_export',
    targetType: 'inquiries',
    summary: `문의 ${inquiries.length}건을 CSV로 내보냈습니다.`,
    detail: { days, rowCount: inquiries.length },
  });
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tryangle-inquiries${suffix}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
