'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/supabase';
import { parseLegacyConsultationText } from '@/lib/legacy-consultation-parser';

async function requireAdmin() {
  if (!(await isLoggedIn())) redirect('/admin/login');
}

export async function importLegacyStaging(formData: FormData) {
  await requireAdmin();
  const sourceFilename = String(formData.get('sourceFilename') ?? 'legacy.txt').trim() || 'legacy.txt';
  const sourceText = String(formData.get('sourceText') ?? '').trim();
  if (!sourceText || sourceText.length > 500_000) redirect('/admin/legacy-import?error=invalid');
  const rows = parseLegacyConsultationText(sourceText);
  const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
  const supabase = db();
  const { data: batch, error: batchError } = await supabase.from('legacy_import_batches').insert({ source_filename: sourceFilename, source_sha256: sourceSha256, row_count: rows.length, status: 'reviewing', imported_by: 'admin' }).select('id').single();
  if (batchError) redirect('/admin/legacy-import?error=import');
  const { error: rowsError } = await supabase.from('legacy_import_rows').insert(rows.map((row) => ({ batch_id: batch.id, row_number: row.rowNumber, raw_text: row.rawText, record_kind: row.recordKind, cohort_label: row.cohortLabel, consulted_at: row.consultedAt, normalized_name: row.normalizedName, age: row.age, gender: row.gender, experience: row.experience, payment_note: row.paymentNote, metadata: row.metadata })));
  if (rowsError) redirect('/admin/legacy-import?error=import');
  await audit({ action: 'legacy_import_staging', targetType: 'legacy_import_batch', targetId: batch.id, summary: 'Legacy data staged for review', detail: { sourceFilename, rowCount: rows.length } });
  revalidatePath('/admin/legacy-import');
  redirect(`/admin/legacy-import?batch=${batch.id}`);
}

export async function updateLegacyImportRow(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('rowId') ?? '').trim();
  if (!id) return;
  const allowed = new Set(['unmatched', 'candidate', 'confirmed', 'rejected', 'needs_review']);
  const matchStatus = String(formData.get('matchStatus') ?? 'needs_review');
  if (!allowed.has(matchStatus)) return;
  const actorId = String(formData.get('candidateActorId') ?? '').trim() || null;
  const inquiryId = String(formData.get('candidateInquiryId') ?? '').trim() || null;
  const { error } = await db().from('legacy_import_rows').update({ normalized_name: String(formData.get('normalizedName') ?? '').trim() || null, cohort_label: String(formData.get('cohortLabel') ?? '').trim() || null, age: Number(formData.get('age')) || null, gender: String(formData.get('gender') ?? '').trim() || null, experience: String(formData.get('experience') ?? '').trim() || null, candidate_actor_id: actorId, candidate_inquiry_id: inquiryId, match_status: matchStatus, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/legacy-import');
}

export async function suggestLegacyMatches(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get('batchId') ?? '').trim();
  if (!batchId) return;
  const supabase = db();
  const [{ data: rows, error: rowError }, { data: actors, error: actorError }, { data: inquiries, error: inquiryError }] = await Promise.all([
    supabase.from('legacy_import_rows').select('id, normalized_name, age, cohort_label, match_status').eq('batch_id', batchId).not('normalized_name', 'is', null),
    supabase.from('actors').select('id, name, cohort, birth_year'),
    supabase.from('inquiries').select('id, name'),
  ]);
  if (rowError) throw new Error(rowError.message);
  if (actorError) throw new Error(actorError.message);
  if (inquiryError) throw new Error(inquiryError.message);
  for (const row of rows ?? []) {
    if (row.match_status === 'confirmed' || row.match_status === 'rejected') continue;
    const name = String(row.normalized_name ?? '').trim();
    const actorMatches = (actors ?? []).filter((actor) => String(actor.name).trim() === name);
    const inquiryMatches = (inquiries ?? []).filter((inquiry) => String(inquiry.name).trim() === name);
    const actor = actorMatches.length === 1 ? actorMatches[0] : null;
    const inquiry = inquiryMatches.length === 1 ? inquiryMatches[0] : null;
    const status = actorMatches.length + inquiryMatches.length === 1 ? 'candidate' : actorMatches.length + inquiryMatches.length > 1 ? 'needs_review' : 'unmatched';
    await supabase.from('legacy_import_rows').update({ candidate_actor_id: actor?.id ?? null, candidate_inquiry_id: inquiry?.id ?? null, match_status: status, updated_at: new Date().toISOString() }).eq('id', row.id);
  }
  revalidatePath(`/admin/legacy-import?batch=${batchId}`);
}
