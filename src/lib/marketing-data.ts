import 'server-only';
import { db } from './supabase';

export type MarketingSpendRow = {
  id: string;
  spendDate: string;
  platform: string;
  accountName: string | null;
  campaign: string | null;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  note: string | null;
};

export async function listMarketingSpend(): Promise<MarketingSpendRow[]> {
  const { data, error } = await db().from('marketing_spend_daily').select('id, spend_date, platform, account_name, campaign, spend, impressions, clicks, note').order('spend_date', { ascending: false }).order('platform');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    spendDate: row.spend_date as string,
    platform: row.platform as string,
    accountName: row.account_name as string | null,
    campaign: row.campaign as string | null,
    spend: Number(row.spend ?? 0),
    impressions: row.impressions as number | null,
    clicks: row.clicks as number | null,
    note: row.note as string | null,
  }));
}

export async function saveMarketingSpend(input: {
  id: string | null;
  spendDate: string;
  platform: string;
  accountName: string | null;
  campaign: string | null;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  note: string | null;
}) {
  const payload = {
    spend_date: input.spendDate,
    platform: input.platform,
    account_name: input.accountName,
    campaign: input.campaign,
    spend: input.spend,
    impressions: input.impressions,
    clicks: input.clicks,
    note: input.note,
  };
  const query = input.id
    ? db().from('marketing_spend_daily').update(payload).eq('id', input.id)
    : db().from('marketing_spend_daily').upsert(payload, { onConflict: 'spend_date,platform,campaign' });
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteMarketingSpend(id: string) {
  const { error } = await db().from('marketing_spend_daily').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
