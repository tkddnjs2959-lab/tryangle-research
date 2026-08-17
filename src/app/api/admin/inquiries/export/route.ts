import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/admin-auth';
import { listInquiries } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

const cell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const rows = await listInquiries();
  const header = ['created_at', 'name', 'contact', 'message', 'source', 'medium', 'campaign', 'content', 'status'];
  const lines = [header, ...rows.map((row) => [row.createdAt, row.name, row.contact, row.message, row.source, row.medium, row.campaign, row.content, row.status])]
    .map((line) => line.map(cell).join(','));
  return new NextResponse(`\uFEFF${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="tryangle-inquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
