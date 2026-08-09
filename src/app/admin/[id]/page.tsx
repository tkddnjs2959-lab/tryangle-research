import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { aggregate, getActor, getSelfPicks, listResponses } from '@/lib/admin-data';
import { AUDIENCE, CATEGORY_LABEL } from '@/lib/types';
import { removeResponse, toggleLock, toggleWeek1Open } from '../actions';
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

  const [imageAgg, personalityAgg, self, imageResp, personalityResp] = await Promise.all([
    aggregate(id, 'image'),
    aggregate(id, 'personality'),
    getSelfPicks(id),
    listResponses(id, 'image'),
    listResponses(id, 'personality'),
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
            <h2 className={styles.blockTitle}>1주차 분석 내용 공개</h2>
            <p className={styles.blockHint}>
              지금은 카카오톡 연동 전 단계입니다. 공개로 바꾸면 배우가 기존 진행 현황 링크에서
              1주차 분석 내용 확인 섹션을 볼 수 있습니다.
            </p>
          </div>
          <form action={toggleWeek1Open}>
            <input type="hidden" name="actorId" value={actor.id} />
            <input type="hidden" name="open" value={String(!actor.week1Open)} />
            <button className={`${styles.btn} ${actor.week1Open ? styles.ghost : ''}`} type="submit">
              {actor.week1Open ? '배우 화면 비공개로 변경' : '배우에게 1주차 공개'}
            </button>
          </form>
        </div>
        <div className={actor.week1Open ? styles.openTag : styles.closedTag}>
          현재 상태: {actor.week1Open ? '배우에게 공개 중' : '관리자만 확인 가능'}
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
                        <button className={styles.del} type="submit">
                          삭제
                        </button>
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
