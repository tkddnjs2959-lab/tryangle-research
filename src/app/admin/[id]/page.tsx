import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import {
  aggregate,
  getActor,
  getCoachingLinkForActor,
  getSelfPicks,
  listActorWeeks,
  listResponses,
} from '@/lib/admin-data';
import { AUDIENCE, CATEGORY_LABEL } from '@/lib/types';
import { SOURCE_LABEL, WEEK_COUNT, weekLabel } from '@/lib/weeks';
import { removeResponse, sendActorToCoaching, setActorWeek, toggleLock } from '../actions';
import ConfirmButton from '../ConfirmButton';
import LinkBox from './LinkBox';
import Review from './Review';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const { id } = await params;
  const actor = await getActor(id);
  if (!actor) notFound();

  const [imageAgg, personalityAgg, self, imageResp, personalityResp, weeks, coachingLink] =
    await Promise.all([
      aggregate(id, 'image'),
      aggregate(id, 'personality'),
      getSelfPicks(id),
      listResponses(id, 'image'),
      listResponses(id, 'personality'),
      listActorWeeks(id, actor.cohort),
      getCoachingLinkForActor(id),
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

      <LinkBox
        progressToken={actor.progressToken}
        surveys={actor.surveys.map((s) => ({ type: s.type, token: s.token }))}
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
      </section>

      <Review
        actorId={actor.id}
        actorName={actor.name}
        birthYear={actor.birthYear}
        image={{ items: imageAgg.items, n: imageAgg.n, self: self.image }}
        personality={{ items: personalityAgg.items, n: personalityAgg.n, self: self.personality }}
      />

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>개별 응답</h2>
        <p className={styles.blockHint}>
          여기에서만 볼 수 있습니다. 배우에게는 집계만 전달됩니다.
          같은 기기에서 중복 제출한 것으로 보이면 지워주세요.
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
                  <li key={r.id} className={styles.resp}>
                    <div className={styles.respHead}>
                      <strong>응답자 {i + 1}</strong>
                      <span className={styles.dim}>
                        {new Date(r.submittedAt).toLocaleString('ko-KR')} · {r.labels.length}개
                      </span>
                      <form action={removeResponse}>
                        <input type="hidden" name="responseId" value={r.id} />
                        <input type="hidden" name="actorId" value={actor.id} />
                        <ConfirmButton
                          className={styles.del}
                          message={`응답자 ${i + 1}의 응답을 삭제합니다. 되돌릴 수 없습니다.`}
                        >
                          삭제
                        </ConfirmButton>
                      </form>
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
    </main>
  );
}
