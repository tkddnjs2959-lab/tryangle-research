import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/admin-auth';
import { listMarketingSpend } from '@/lib/marketing-data';

export const dynamic = 'force-dynamic';

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  const rows = await listMarketingSpend();
  const header = ['date', 'platform', 'account_name', 'campaign', 'spend', 'impressions', 'clicks', 'note'];
  const lines = [header, ...rows.map((row) => [row.spendDate, row.platform, row.accountName, row.campaign, row.spend, row.impressions, row.clicks, row.note])]
    .map((line) => line.map(csvCell).join(','));
  return new NextResponse(`\uFEFF${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="tryangle-marketing-spend-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
