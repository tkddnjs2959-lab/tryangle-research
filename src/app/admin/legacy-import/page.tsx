import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listLegacyImportBatches, listLegacyImportRows, listLegacyMatchTargets } from '@/lib/legacy-import-data';
import { logout } from '../actions';
import { importLegacyStaging, suggestLegacyMatches, updateLegacyImportRow } from './actions';
import AdminTabs from '../AdminTabs';
import LegacyImportForm from './LegacyImportForm';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function LegacyImportPage({ searchParams }: { searchParams: Promise<{ batch?: string; error?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');
  const params = await searchParams;
  let batches = [] as Awaited<ReturnType<typeof listLegacyImportBatches>>;
  let rows = [] as Awaited<ReturnType<typeof listLegacyImportRows>>;
  let targets = [] as Awaited<ReturnType<typeof listLegacyMatchTargets>>;
  let unavailable = false;
  try { batches = await listLegacyImportBatches(); targets = await listLegacyMatchTargets(); if (params.batch) rows = await listLegacyImportRows(params.batch); } catch { unavailable = true; }
  return <main className={styles.page}>
    <header className={styles.topbar}><div><div className={styles.brand}>TRYANGLE</div><h1 className={styles.h1}>이전 데이터 가져오기</h1><div className={styles.meta}>staging에서 내용을 편집·확인한 뒤 운영 데이터로 승격합니다.</div></div><form action={logout}><button className={`${styles.btn} ${styles.ghost}`} type="submit">로그아웃</button></form></header>
    <AdminTabs active="legacy-import" />
    {unavailable && <p className={styles.warn}>staging migration이 아직 운영 DB에 적용되지 않았습니다.</p>}
    {params.error && <p className={styles.warn}>가져오기에 실패했습니다. staging migration과 원본 형식을 확인해 주세요.</p>}
    <section className={styles.block}><h2 className={styles.blockTitle}>TXT staging 업로드</h2><LegacyImportForm action={importLegacyStaging} /></section>
    <section className={styles.block}><h2 className={styles.blockTitle}>가져오기 배치</h2>{batches.length === 0 ? <p className={styles.empty}>아직 가져온 배치가 없습니다.</p> : <ul className={styles.consultList}>{batches.map((batch) => <li key={batch.id} className={styles.consultItem}><div className={styles.respHead}><strong>{batch.sourceFilename}</strong><span className={styles.meta}>{batch.rowCount}행 · {batch.status} · {new Date(batch.createdAt).toLocaleString('ko-KR')}</span></div><a className={styles.btn} href={`/admin/legacy-import?batch=${batch.id}`}>행 검토</a></li>)}</ul>}</section>
    {params.batch && <section className={styles.block}><div className={styles.respHead}><h2 className={styles.blockTitle}>행 편집 <em className={styles.countBadge}>{rows.length}</em></h2><form action={suggestLegacyMatches}><input type="hidden" name="batchId" value={params.batch} /><button className={`${styles.btn} ${styles.sm}`} type="submit">기존 데이터와 후보 매칭</button></form></div><ul className={styles.consultList}>{rows.slice(0, 200).map((row) => <li key={row.id} className={styles.consultItem}><form action={updateLegacyImportRow} className={styles.consultForm}><input type="hidden" name="rowId" value={row.id} /><div className={styles.respHead}><strong>#{row.rowNumber} · {row.rawText}</strong><span className={styles.meta}>{row.recordKind} · {row.matchStatus}</span></div><div className={styles.consultGrid}><input name="normalizedName" className={styles.input} defaultValue={row.normalizedName ?? ''} placeholder="이름" /><input name="cohortLabel" className={styles.input} defaultValue={row.cohortLabel ?? ''} placeholder="기수" /><input name="age" type="number" className={styles.input} defaultValue={row.age ?? ''} placeholder="연령" /><input name="gender" className={styles.input} defaultValue={row.gender ?? ''} placeholder="성별" /><input name="experience" className={styles.input} defaultValue={row.experience ?? ''} placeholder="경험" /><select name="candidateActorId" className={styles.input} defaultValue={row.candidateActorId ?? ''}><option value="">배우 연결 없음</option>{targets.filter((target) => target.type === 'actor').map((target) => <option key={target.id} value={target.id}>{target.name}{target.cohort ? ` · ${target.cohort}` : ''}</option>)}</select><select name="candidateInquiryId" className={styles.input} defaultValue={row.candidateInquiryId ?? ''}><option value="">문의 연결 없음</option>{targets.filter((target) => target.type === 'inquiry').map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select><select name="matchStatus" className={styles.input} defaultValue={row.matchStatus}><option value="unmatched">미매칭</option><option value="candidate">후보</option><option value="needs_review">확인 필요</option><option value="confirmed">확정</option><option value="rejected">제외</option></select></div><button className={`${styles.btn} ${styles.sm}`} type="submit">행 저장</button></form></li>)}</ul></section>}
  </main>;
}
