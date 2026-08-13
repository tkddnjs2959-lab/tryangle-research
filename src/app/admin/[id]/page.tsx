import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import {
  aggregate,
  getActor,
  getCoachingLinkForActor,
  listActionItems,
  listConsultationSessions,
  getSelfPicks,
  listActorWeeks,
  listResponses,
} from '@/lib/admin-data';
import { listAuditFor } from '@/lib/audit';
import { AUDIENCE, CATEGORY_LABEL } from '@/lib/types';
import { SOURCE_LABEL, WEEK_COUNT, weekLabel } from '@/lib/weeks';
import {
  removeResponse,
  sendActorToCoaching,
  setActorWeek,
  toggleLock,
  undoRemoveResponse,
} from '../actions';
import {
  addConsultationActionItem,
  archiveConsultation,
  completeConsultationActionItem,
  createConsultation,
  sendActorKakaoTest,
  unlinkActorKakao,
  reviewConsultationAnalysis,
  runConsultationAnalysis,
} from '../actions';
import ConfirmButton from '../ConfirmButton';
import NotifyBanner from '../NotifyBanner';
import LinkBox from './LinkBox';
import Review from './Review';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const ANALYSIS_SECTIONS = [
  ['consultation_purpose', '상담 목적'],
  ['current_concerns', '현재 고민'],
  ['goals', '목표'],
  ['strengths', '강점'],
  ['barriers', '장애 요인'],
  ['external_image_observations', '외적 이미지 관찰'],
  ['internal_image_observations', '내적 이미지 관찰'],
  ['character_position_hypotheses', '캐릭터 포지션 가설'],
  ['profile_strategy', '프로필 전략'],
  ['acting_material_recommendations', '연기 자료 추천'],
  ['agreed_actions', '합의한 후속 조치'],
  ['follow_up_questions', '후속 질문'],
  ['risk_flags', '위험 신호'],
  ['evidence', '원문 근거'],
] as const;

function analysisItemText(value: unknown) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return String(value ?? '');
  const item = value as Record<string, unknown>;
  if (typeof item.quote === 'string') {
    return [item.claim, item.speaker, item.quote].filter(Boolean).map(String).join(' · ');
  }
  return Object.values(item).filter((part) => part != null && part !== '').map(String).join(' · ');
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nweek?: string; nsent?: string; nskip?: string; nfail?: string; kakao_test?: string; kakao_unlink?: string }>;
}) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const { id } = await params;
  const notify = await searchParams;
  const actor = await getActor(id);
  if (!actor) notFound();

  const [
    imageAgg,
    personalityAgg,
    self,
    imageResp,
    personalityResp,
    weeks,
    coachingLink,
    history,
    consultations,
    actionItems,
  ] = await Promise.all([
    aggregate(id, 'image'),
    aggregate(id, 'personality'),
    getSelfPicks(id),
    // 삭제된 응답도 함께 받아 복구할 수 있게 한다 (집계에는 들어가지 않는다).
    listResponses(id, 'image', true),
    listResponses(id, 'personality', true),
    listActorWeeks(id, actor.cohort),
    getCoachingLinkForActor(id),
    listAuditFor('actor', id),
    listConsultationSessions(id),
    listActionItems(id),
  ]);

  const responses = { image: imageResp, personality: personalityResp };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <Link href="/admin" className={styles.back}>
            ← 캐릭터포지셔닝 관리
          </Link>
          <h1 className={styles.h1}>{actor.name}</h1>
          <div className={styles.meta}>
            {[
              actor.birthYear && `${actor.birthYear}년생`,
              actor.cohort,
              actor.gender === 'female' ? '여자 ver' : '남자 ver',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </header>

      <NotifyBanner params={notify} />
      {notify.kakao_test && (
        <div className={`${styles.banner} ${notify.kakao_test === 'sent' ? styles.bannerOk : styles.bannerWarn}`}>
          {notify.kakao_test === 'sent' && '카카오 테스트 알림을 발송했습니다.'}
          {notify.kakao_test === 'failed' && '카카오 테스트 알림 발송에 실패했습니다. 배우에게 재연결을 요청해주세요.'}
          {notify.kakao_test === 'not_ready' && '카카오 메시지 동의가 없어 테스트 알림을 보낼 수 없습니다.'}
        </div>
      )}
      {notify.kakao_unlink && (
        <div className={`${styles.banner} ${notify.kakao_unlink === 'remote_ok' ? styles.bannerOk : styles.bannerWarn}`}>
          {notify.kakao_unlink === 'remote_ok' && '카카오 연결과 서비스 내부 연결 정보를 모두 해제했습니다.'}
          {notify.kakao_unlink === 'local_only' && '서비스 내부 연결 정보는 해제했지만 카카오 원격 해제 확인에는 실패했습니다. 배우가 카카오 설정에서 연결 상태를 확인해주세요.'}
        </div>
      )}

      <LinkBox
        progressToken={actor.progressToken}
        surveys={actor.surveys.map((s) => ({ type: s.type, token: s.token }))}
        kakaoLinked={actor.kakaoLinked}
        notifyReady={actor.notifyReady}
        notifyNeedsReconnect={actor.notifyNeedsReconnect}
      />

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>수집 현황</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>리서치</th>
              <th>대상</th>
              <th className={styles.num}>응답</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {actor.surveys.map((s) => (
              <tr key={s.type}>
                <td>{CATEGORY_LABEL[s.type]}</td>
                <td className={styles.dim}>{AUDIENCE[s.type]}</td>
                <td className={styles.num}>
                  <b className={s.met ? styles.ok : styles.no}>{s.n}</b> / {s.minN}
                </td>
                <td>
                  {s.isOpen ? (
                    <span className={styles.openTag}>모집 중</span>
                  ) : (
                    <span className={styles.closedTag}>마감</span>
                  )}
                </td>
                <td>
                  <form action={toggleLock}>
                    <input type="hidden" name="actorId" value={actor.id} />
                    <input type="hidden" name="type" value={s.type} />
                    <input type="hidden" name="locked" value={String(s.isOpen)} />
                    <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">
                      {s.isOpen ? '마감하기' : '다시 열기'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.block}>
        <div className={styles.weekHead}>
          <div>
            <h2 className={styles.blockTitle}>주차 공개</h2>
            <p className={styles.blockHint}>
              {actor.cohort ? (
                <>
                  기본은 <strong>{actor.cohort}</strong> 기수 설정을 따릅니다. 기수 전체를 여는 것은{' '}
                  <Link href={`/admin/cohort/${encodeURIComponent(actor.cohort)}`}>
                    {actor.cohort} 주차 관리
                  </Link>
                  에서 하고, 여기서는 이 배우만 다르게 할 때 예외를 겁니다.
                </>
              ) : (
                <>
                  이 배우는 기수가 지정되지 않아 기수 단위 공개가 적용되지 않습니다.
                  아래에서 배우 개별로만 열 수 있습니다.
                </>
              )}
            </p>
          </div>
          <span className={actor.openWeeks.length > 0 ? styles.openTag : styles.closedTag}>
            {actor.openWeeks.length}/{WEEK_COUNT}주차 공개
          </span>
        </div>

        <ul className={styles.weekList}>
          {weeks.map((w) => (
            <li key={w.week} className={`${styles.weekRow} ${w.open ? styles.weekRowOpen : ''}`}>
              <div>
                <div className={styles.weekName}>{weekLabel(w.week, w.title)}</div>
                <div className={styles.weekWhy}>
                  {SOURCE_LABEL[w.source]}
                  {w.override !== null && ` · 기수 설정: ${w.cohortOpen ? '공개' : '비공개'}`}
                </div>
              </div>
              <div className={styles.weekBtns}>
                {w.override !== null && (
                  <form action={setActorWeek}>
                    <input type="hidden" name="actorId" value={actor.id} />
                    <input type="hidden" name="week" value={w.week} />
                    <input type="hidden" name="mode" value="follow" />
                    <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">
                      기수 설정 따르기
                    </button>
                  </form>
                )}
                <form action={setActorWeek}>
                  <input type="hidden" name="actorId" value={actor.id} />
                  <input type="hidden" name="week" value={w.week} />
                  <input type="hidden" name="mode" value={w.open ? 'close' : 'open'} />
                  <button
                    className={`${styles.btn} ${styles.sm} ${w.open ? styles.ghost : ''}`}
                    type="submit"
                  >
                    {w.open ? '이 배우만 비공개' : '이 배우에게 공개'}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block}>
        <div className={styles.weekHead}>
          <div>
            <h2 className={styles.blockTitle}>1:1 매체연기 코칭 연동</h2>
            <p className={styles.blockHint}>
              {coachingLink
                ? '이 배우는 1:1 코칭 트랙으로 넘어갔습니다. 코칭 탭에서 이 배우의 기수·리서치 진행·공개 주차를 함께 볼 수 있습니다.'
                : '캐릭터 포지셔닝 클래스를 마치고 1:1 코칭으로 넘어가면 여기서 연동합니다. 코칭 탭에 학생으로 등록되고, 배우 정보와 리서치 진행이 그쪽에서도 보입니다.'}
            </p>
          </div>
          {coachingLink ? (
            <Link href="/admin/coaching" className={`${styles.btn} ${styles.ghost}`}>
              코칭 탭에서 보기
            </Link>
          ) : (
            <form action={sendActorToCoaching}>
              <input type="hidden" name="actorId" value={actor.id} />
              <button className={styles.btn} type="submit">
                1:1 코칭으로 연동
              </button>
            </form>
          )}
        </div>
        <div className={coachingLink ? styles.openTag : styles.closedTag}>
          현재 상태: {coachingLink ? '코칭 트랙 연동됨' : '퍼스널 브랜딩 트랙만 진행 중'}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>카카오 로그인 · 배우 정보 등록</h2>
        <p className={styles.blockHint}>
          배우에게 진행 현황 링크를 전달하면, 배우가 카카오톡으로 로그인한 뒤 본인 정보를 등록할 수 있습니다.
        </p>
        <div className={styles.infoGrid}>
          <div>
            <strong>카카오 연결</strong>
            <span className={actor.kakaoLinked ? styles.ok : styles.no}>
              {actor.kakaoLinked ? '연결됨' : '미연결'}
            </span>
          </div>
          <div>
            <strong>주차 공개 알림</strong>
            <span className={actor.notifyReady ? styles.ok : styles.no}>
              {actor.notifyReady ? '보낼 수 있음' : '메시지 동의 없음'}
            </span>
          </div>
          <div>
            <strong>등록 정보</strong>
            <span>
              {actor.actorProfile
                ? `${actor.actorProfile.name} · ${actor.actorProfile.phone}`
                : '미등록'}
            </span>
          </div>
          <div>
            <strong>배우 진행 링크</strong>
            <code>{`/s/${actor.progressToken}`}</code>
          </div>
        </div>
        <div className={styles.linkedActions}>
          <form action={sendActorKakaoTest}>
            <input type="hidden" name="actorId" value={actor.id} />
            <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit" disabled={!actor.notifyReady}>
              테스트 알림 보내기
            </button>
          </form>
          {actor.kakaoLinked && (
            <form action={unlinkActorKakao}>
              <input type="hidden" name="actorId" value={actor.id} />
              <ConfirmButton className={`${styles.btn} ${styles.ghost} ${styles.sm}`} message="이 배우의 카카오 연결을 해제하시겠습니까?">
                연결 해제
              </ConfirmButton>
            </form>
          )}
        </div>
      </section>

      <Review
        actorId={actor.id}
        actorName={actor.name}
        birthYear={actor.birthYear}
        image={{ items: imageAgg.items, n: imageAgg.n, self: self.image }}
        personality={{ items: personalityAgg.items, n: personalityAgg.n, self: self.personality }}
      />

      <section className={styles.block}>
        <div className={styles.weekHead}>
          <div>
            <h2 className={styles.blockTitle}>상담 CRM</h2>
            <p className={styles.blockHint}>상담 원문은 별도 상담 기록에 저장됩니다. AI 분석은 검수 전 초안이며, 상담 원문 저장과 분리되어 있습니다.</p>
          </div>
          <span className={styles.openTag}>{consultations.length}건</span>
        </div>
        <form action={createConsultation} className={styles.consultForm} encType="multipart/form-data">
          <input type="hidden" name="actorId" value={actor.id} />
          <label>상담일시<input name="consultedAt" type="datetime-local" required /></label>
          <label>상담 유형<select name="consultationType" defaultValue="general"><option value="general">일반 상담</option><option value="profile">프로필</option><option value="coaching">코칭</option><option value="follow_up">후속 상담</option></select></label>
          <label>상담 시간(초)<input name="durationSeconds" type="number" min="0" /></label>
          <label>상담자<input name="counselorName" placeholder="이름" /></label>
          <label className={styles.fullField}>상담 원문<textarea name="transcript" rows={7} placeholder="클로바노트에서 텍스트를 복사해 붙여넣으세요." /></label>
          <label>텍스트 파일 불러오기<input name="transcriptFile" type="file" accept=".txt,text/plain" /></label>
          <label>출처<select name="source" defaultValue="manual"><option value="manual">수동 입력</option><option value="clova_note_import">클로바노트 가져오기</option></select></label>
          <label className={styles.fullField}>녹음 파일 경로 또는 메모<input name="recordingPath" /></label>
          <label className={styles.consent}><input name="consent" type="checkbox" required /> 개인정보 처리 및 AI 분석 동의 확인</label>
          <button className={styles.btn} type="submit">상담 등록</button>
        </form>
        {consultations.length === 0 ? <p className={styles.empty}>등록된 상담이 없습니다.</p> : <div className={styles.consultList}>
          {consultations.map((c) => {
            const latest = c.analyses[0];
            const approved = c.analyses.find((analysis) => analysis.status === 'approved');
            const result = latest?.structuredResult ?? {};
            return <article key={c.id} className={styles.consultCard}>
              <div className={styles.consultHead}><div><strong>{new Date(c.consultedAt).toLocaleString('ko-KR')}</strong><span className={styles.dim}> · {c.consultationType} · {c.source === 'clova_note_import' ? '클로바노트 수동 가져오기' : '수동 입력'}</span></div><span className={latest?.status === 'approved' ? styles.openTag : styles.statusTag}>{latest ? (latest.status === 'pending' ? '검수 필요' : latest.status === 'approved' ? '승인됨' : latest.status === 'rejected' ? '거절됨' : '분석 실패') : '분석 대기'}</span></div>
              <div className={styles.consultMeta}>원문: {c.transcript ? '등록됨' : '없음'} · 미완료 후속 조치 {c.actionItemCount}개</div>
              {c.transcript && <details><summary>상담 원문 보기</summary><p className={styles.transcript}>{c.transcript.fullText}</p></details>}
              {c.transcript && <div className={styles.consultActions}><form action={runConsultationAnalysis}><input type="hidden" name="sessionId" value={c.id} /><button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">AI 분석 실행</button></form><form action={archiveConsultation}><input type="hidden" name="sessionId" value={c.id} /><input type="hidden" name="actorId" value={actor.id} /><ConfirmButton className={`${styles.btn} ${styles.ghost} ${styles.sm}`} message="이 상담을 보관하시겠습니까?">보관</ConfirmButton></form></div>}
              {approved && approved.id !== latest?.id && <p className={styles.consultMeta}>최신 확정 분석: v{approved.analysisVersion}</p>}
              {latest && <div className={styles.analysisBox}>
                <h3>AI 분석 v{latest.analysisVersion}</h3>
                <p>{String(result.summary || latest.summary || '')}</p>
                {latest.status !== 'failed' && ANALYSIS_SECTIONS.map(([key, label]) => {
                  const value = result[key];
                  const items = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
                  if (items.length === 0) return null;
                  return <div key={key} className={styles.analysisSection}><strong>{label}</strong><ul>{items.map((item, index) => <li key={`${key}-${index}`}>{analysisItemText(item)}</li>)}</ul></div>;
                })}
                {latest.status === 'pending' && <form action={reviewConsultationAnalysis} className={styles.consultActions}><input type="hidden" name="analysisId" value={latest.id} /><input type="hidden" name="sessionId" value={c.id} /><button className={styles.btn} name="status" value="approved">승인</button><button className={`${styles.btn} ${styles.ghost}`} name="status" value="rejected">거절</button></form>}
              </div>}
            </article>;
          })}
        </div>}
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>상담 후속 조치</h2>
        <form action={addConsultationActionItem} className={styles.actionForm}><input type="hidden" name="actorId" value={actor.id} /><select name="sessionId" required defaultValue=""><option value="" disabled>상담 선택</option>{consultations.map((c) => <option key={c.id} value={c.id}>{new Date(c.consultedAt).toLocaleDateString('ko-KR')} · {c.consultationType}</option>)}</select><input name="title" placeholder="후속 조치" required /><input name="dueAt" type="date" /><button className={`${styles.btn} ${styles.sm}`} type="submit">추가</button></form>
        {actionItems.length === 0 ? <p className={styles.empty}>미완료 후속 조치가 없습니다.</p> : <ul className={styles.auditList}>{actionItems.map((item) => <li key={item.id} className={styles.auditItem}><span>{item.title}{item.dueAt ? ` · 기한 ${new Date(item.dueAt).toLocaleDateString('ko-KR')}` : ''}</span><form action={completeConsultationActionItem}><input type="hidden" name="actionItemId" value={item.id} /><input type="hidden" name="actorId" value={actor.id} /><button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">완료</button></form></li>)}</ul>}
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>개별 응답</h2>
        <p className={styles.blockHint}>
          여기에서만 볼 수 있습니다. 배우에게는 집계만 전달됩니다.
          같은 기기에서 중복 제출한 것으로 보이면 지워주세요.
          삭제해도 목록에는 남아 있어 복구할 수 있고, 집계에서만 즉시 빠집니다.
        </p>

        {(['image', 'personality'] as const).map((cat) => (
          <div key={cat} className={styles.respGroup}>
            <h3 className={styles.respTitle}>
              {CATEGORY_LABEL[cat]} <em>{responses[cat].length}건</em>
            </h3>
            {responses[cat].length === 0 ? (
              <p className={styles.empty}>아직 응답이 없습니다.</p>
            ) : (
              <ul className={styles.respList}>
                {responses[cat].map((r, i) => (
                  <li key={r.id} className={`${styles.resp} ${r.deletedAt ? styles.respDeleted : ''}`}>
                    <div className={styles.respHead}>
                      <strong>응답자 {i + 1}</strong>
                      <span className={styles.dim}>
                        {new Date(r.submittedAt).toLocaleString('ko-KR')} · {r.labels.length}개
                        {r.deletedAt && ' · 삭제됨 (집계 제외)'}
                      </span>
                      {r.deletedAt ? (
                        <form action={undoRemoveResponse}>
                          <input type="hidden" name="responseId" value={r.id} />
                          <input type="hidden" name="actorId" value={actor.id} />
                          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">
                            복구
                          </button>
                        </form>
                      ) : (
                        <form action={removeResponse}>
                          <input type="hidden" name="responseId" value={r.id} />
                          <input type="hidden" name="actorId" value={actor.id} />
                          <input type="hidden" name="label" value={`${CATEGORY_LABEL[cat]} 응답자 ${i + 1}`} />
                          <ConfirmButton
                            className={styles.del}
                            message={`응답자 ${i + 1}의 응답을 집계에서 제외합니다. 이 목록에 남아 있어 복구할 수 있습니다.`}
                          >
                            삭제
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                    <div className={styles.respTags}>
                      {r.labels.map((l) => (
                        <span key={l} className={styles.tag}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>변경 이력</h2>
        <p className={styles.blockHint}>
          이 배우에게 일어난 최근 변경입니다. 무엇을 눌렀는지 되짚을 때 씁니다.
        </p>
        {history.length === 0 ? (
          <p className={styles.empty}>아직 기록이 없습니다.</p>
        ) : (
          <ul className={styles.auditList}>
            {history.map((h) => (
              <li key={h.id} className={styles.auditItem}>
                <span className={styles.auditWhen}>
                  {new Date(h.createdAt).toLocaleString('ko-KR')}
                </span>
                <span>{h.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
