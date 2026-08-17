import 'server-only';
import { db } from './supabase';

export type LegacyImportBatchRow = { id: string; sourceFilename: string; status: string; rowCount: number; createdAt: string };
export type LegacyImportStagingRow = { id: string; rowNumber: number; rawText: string; recordKind: string; cohortLabel: string | null; normalizedName: string | null; age: number | null; gender: string | null; experience: string | null; paymentNote: string | null; candidateActorId: string | null; candidateInquiryId: string | null; matchStatus: string };
export type LegacyMatchTarget = { id: string; name: string; type: 'actor' | 'inquiry'; cohort?: string | null };

export async function listLegacyImportBatches(): Promise<LegacyImportBatchRow[]> {
  const { data, error } = await db().from('legacy_import_batches').select('id, source_filename, status, row_count, created_at').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id as string, sourceFilename: row.source_filename as string, status: row.status as string, rowCount: row.row_count as number, createdAt: row.created_at as string }));
}

export async function listLegacyImportRows(batchId: string): Promise<LegacyImportStagingRow[]> {
  const { data, error } = await db().from('legacy_import_rows').select('id, row_number, raw_text, record_kind, cohort_label, normalized_name, age, gender, experience, payment_note, candidate_actor_id, candidate_inquiry_id, match_status').eq('batch_id', batchId).order('row_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id as string, rowNumber: row.row_number as number, rawText: row.raw_text as string, recordKind: row.record_kind as string, cohortLabel: row.cohort_label as string | null, normalizedName: row.normalized_name as string | null, age: row.age as number | null, gender: row.gender as string | null, experience: row.experience as string | null, paymentNote: row.payment_note as string | null, candidateActorId: row.candidate_actor_id as string | null, candidateInquiryId: row.candidate_inquiry_id as string | null, matchStatus: row.match_status as string }));
}

export async function listLegacyMatchTargets(): Promise<LegacyMatchTarget[]> {
  const [{ data: actors, error: actorError }, { data: inquiries, error: inquiryError }] = await Promise.all([
    db().from('actors').select('id, name, cohort').neq('status', 'archived').order('name'),
    db().from('inquiries').select('id, name').neq('status', 'archived').order('name'),
  ]);
  if (actorError) throw new Error(actorError.message);
  if (inquiryError) throw new Error(inquiryError.message);
  return [
    ...(actors ?? []).map((row) => ({ id: row.id as string, name: row.name as string, type: 'actor' as const, cohort: row.cohort as string | null })),
    ...(inquiries ?? []).map((row) => ({ id: row.id as string, name: row.name as string, type: 'inquiry' as const })),
  ];
}
