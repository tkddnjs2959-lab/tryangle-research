import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listActors, listConsultations, listInquiries } from '@/lib/admin-data';
import { importConsultation, logout, reviewConsultationAnalysis, runConsultationAnalysis } from '../actions';
import AdminTabs from '../AdminTabs';
import ConsultationImportForm from './ConsultationImportForm';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '상담 기록 · 관리자', robots: { index: false, follow: false } };

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ analysis_error?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');
  const params = await searchParams;
  const [actors, inquiries, consultations] = await Promise.all([listActors(), listInquiries(), listConsultations()]);
  const activeActors = actors.filter((actor) => actor.status !== 'archived');
  const openInquiries = inquiries.filter((inquiry) => inquiry.status !== 'archived');
  const options = [
    ...activeActors.map((actor) => ({ id: `actor:${actor.id}`, label: `배우 · ${actor.name}` })),
    ...openInquiries.map((inquiry) => ({ id: `inquiry:${inquiry.id}`, label: `문의 · ${inquiry.name}` })),
  ];
  const names = new Map(options.map((option) => [option.id, option.label]));

  return (
    <main className={styles.page}>
      <header className={styles.topbar}><div><div className={styles.brand}>TRYANGLE</div><h1 className={styles.h1}>상담 기록</h1><div className={styles.meta}>Clova Note 텍스트를 첨부하면 저장과 AI 분석을 한 번에 처리합니다.</div></div><form action={logout}><button className={`${styles.btn} ${styles.ghost}`} type="submit">로그아웃</button></form></header>
      <AdminTabs active="consultations" />
      {params.analysis_error && <p className={styles.warn}>상담은 저장됐지만 AI 분석에 실패했습니다. 키·동의·원문 상태를 확인한 뒤 목록에서 다시 실행해 주세요.</p>}
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Clova Note 상담 등록</h2>
        <p className={styles.blockHint}>TXT 파일을 드래그하거나 텍스트를 붙여넣고 저장하면 Gemini 분석 결과가 자동으로 대기 상태로 저장됩니다.</p>
        <ConsultationImportForm action={importConsultation} options={options} />
      </section>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>등록된 상담 <em className={styles.countBadge}>{consultations.length}</em></h2>
        {consultations.length === 0 ? <p className={styles.empty}>등록된 상담 기록이 없습니다.</p> : <ul className={styles.consultList}>{consultations.map((consultation) => {
          const target = consultation.actorId ? names.get(`actor:${consultation.actorId}`) : consultation.inquiryId ? names.get(`inquiry:${consultation.inquiryId}`) : '연결 대상 없음';
          return <li key={consultation.id} className={styles.consultItem}>
            <div className={styles.respHead}><strong>{target}</strong><span className={styles.meta}>{new Date(consultation.consultedAt).toLocaleString('ko-KR')} · {consultation.source === 'clova_note_import' ? 'Clova Note' : '수기'} · {consultation.status}</span></div>
            <div className={styles.consultMeta}>분석: {consultation.analysisStatus ?? '없음'} · 동의: {consultation.consentObtainedAt ? '확인' : '없음'}</div>
            <div className={styles.consultActions}>
              {consultation.consentObtainedAt && consultation.transcript && (!consultation.analysisStatus || consultation.analysisStatus === 'rejected' || consultation.analysisStatus === 'failed') && <form action={runConsultationAnalysis}><input type="hidden" name="sessionId" value={consultation.id} /><button className={`${styles.btn} ${styles.sm}`} type="submit">AI 분석 재실행</button></form>}
              {consultation.analysisId && consultation.analysisStatus === 'pending' && <><form action={reviewConsultationAnalysis}><input type="hidden" name="analysisId" value={consultation.analysisId} /><input type="hidden" name="status" value="approved" /><button className={`${styles.btn} ${styles.sm}`} type="submit">분석 승인</button></form><form action={reviewConsultationAnalysis}><input type="hidden" name="analysisId" value={consultation.analysisId} /><input type="hidden" name="status" value="rejected" /><button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">반려</button></form></>}
            </div>
            {consultation.analysisSummary && <p className={styles.consultAnalysis}>{consultation.analysisSummary}</p>}
            {consultation.actionItems.length > 0 && <ul className={styles.actionList}>{consultation.actionItems.map((item) => <li key={item.id}><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}<em>{item.status}{item.dueAt ? ` · ${new Date(item.dueAt).toLocaleDateString('ko-KR')}` : ''}</em></li>)}</ul>}
            {consultation.transcript && <p className={styles.consultPreview}>{consultation.transcript.slice(0, 360)}{consultation.transcript.length > 360 ? '…' : ''}</p>}
          </li>;
        })}</ul>}
      </section>
    </main>
  );
}
