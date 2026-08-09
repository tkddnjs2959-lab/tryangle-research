import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listActors, listCohortWeeks } from '@/lib/admin-data';
import { WEEK_COUNT } from '@/lib/weeks';
import { saveCohortWeekTitle, toggleCohortWeek } from '../../actions';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

/**
 * 기수 하나의 1~12주차 관리.
 *
 * 여기서 연 주차는 그 기수 배우 전원에게 열린다.
 * 특정 배우만 다르게 하려면 배우 상세 화면에서 예외를 건다.
 */
export default async function Page({ params }: { params: Promise<{ cohort: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const { cohort: raw } = await params;
  const cohort = decodeURIComponent(raw);

  const [weeks, actors] = await Promise.all([listCohortWeeks(cohort), listActors()]);
  const members = actors.filter((a) => a.status !== 'archived' && a.cohort === cohort);
  const openCount = weeks.filter((w) => w.isOpen).length;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <Link href="/admin" className={styles.back}>
            ← 캐릭터포지셔닝 관리
          </Link>
          <h1 className={styles.h1}>{cohort} 주차 관리</h1>
          <div className={styles.meta}>
            배우 {members.length}명 · {WEEK_COUNT}주차 중 {openCount}주차 공개
          </div>
        </div>
      </header>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>주차 커리큘럼 · 공개</h2>
        <p className={styles.blockHint}>
          공개로 바꾸면 이 기수 배우 전원의 진행 현황 화면에 해당 주차가 나타납니다.
          제목은 배우 화면에도 그대로 보이므로, 정해지기 전까지는 비워두면 &lsquo;N주차&rsquo;로만 표시됩니다.
          특정 배우만 먼저 열거나 막아야 하면 배우 상세 화면에서 예외를 걸 수 있습니다.
        </p>

        <ul className={styles.weekList}>
          {weeks.map((w) => (
            <li key={w.week} className={styles.weekItem}>
              <div className={styles.weekNo}>{w.week}주차</div>

              <form action={saveCohortWeekTitle} className={styles.weekTitleForm}>
                <input type="hidden" name="cohort" value={cohort} />
                <input type="hidden" name="week" value={w.week} />
                <input
                  className={styles.weekTitleInput}
                  type="text"
                  name="title"
                  defaultValue={w.title ?? ''}
                  placeholder="주차 이름 (예: 퍼스널 리서치 툴)"
                  maxLength={60}
                />
                <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">
                  이름 저장
                </button>
              </form>

              <div className={styles.weekState}>
                <span className={w.isOpen ? styles.openTag : styles.closedTag}>
                  {w.isOpen ? '공개 중' : '비공개'}
                </span>
                <form action={toggleCohortWeek}>
                  <input type="hidden" name="cohort" value={cohort} />
                  <input type="hidden" name="week" value={w.week} />
                  <input type="hidden" name="open" value={String(!w.isOpen)} />
                  <button
                    className={`${styles.btn} ${styles.sm} ${w.isOpen ? styles.ghost : ''}`}
                    type="submit"
                  >
                    {w.isOpen ? '비공개로' : '기수 전체 공개'}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>이 기수 배우</h2>
        {members.length === 0 ? (
          <p className={styles.empty}>이 기수에 배정된 배우가 없습니다.</p>
        ) : (
          <div className={styles.cards}>
            {members.map((a) => (
              <Link key={a.id} href={`/admin/${a.id}`} className={styles.card}>
                <div className={styles.cardHead}>
                  <strong>{a.name}</strong>
                  <span className={styles.meta}>
                    {a.openWeeks.length}/{WEEK_COUNT}주차 공개
                  </span>
                </div>
                <div className={styles.weekDots}>
                  {weeks.map((w) => (
                    <span
                      key={w.week}
                      className={a.openWeeks.includes(w.week) ? styles.weekDotOn : styles.weekDotOff}
                      title={`${w.week}주차`}
                    >
                      {w.week}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
