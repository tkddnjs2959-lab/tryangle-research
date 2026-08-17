import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { countNewInquiries, listActors, listOpenWeekCountByCohort } from '@/lib/admin-data';
import {
  STATUS_SUMMARY_LABEL,
  actorStatus,
  compareByStatus,
  type ActorStatusKey,
} from '@/lib/actor-status';
import { CATEGORY_LABEL } from '@/lib/types';
import { WEEK_COUNT } from '@/lib/weeks';
import { logout } from './actions';
import AddActorForm from './AddActorForm';
import AdminTabs from './AdminTabs';
import styles from './admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '캐릭터포지셔닝 관리 · 어드민', robots: { index: false, follow: false } };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const [actors, newInquiries, openWeeksByCohort, sp] = await Promise.all([
    listActors(),
    countNewInquiries(),
    listOpenWeekCountByCohort(),
    searchParams,
  ]);

  const q = (sp.q ?? '').trim();
  const needle = q.toLowerCase();

  const all = actors
    .filter((a) => a.status !== 'archived')
    .map((a) => ({ ...a, next: actorStatus({ surveys: a.surveys, openWeeks: a.openWeeks }) }));

  const active = needle
    ? all.filter(
        (a) =>
          a.name.toLowerCase().includes(needle) ||
          (a.cohort ?? '').toLowerCase().includes(needle)
      )
    : all;

  // 상태별 몇 명인지 — 목록을 훑기 전에 오늘 할 일의 규모를 먼저 보여준다.
  const summary = new Map<ActorStatusKey, number>();
  for (const a of active) summary.set(a.next.key, (summary.get(a.next.key) ?? 0) + 1);

  const UNASSIGNED = '기수 미지정';
  const groups = new Map<string, typeof active>();
  for (const a of active) {
    const key = a.cohort || UNASSIGNED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  // 기수 안에서는 조치가 필요한 배우를 위로 올린다.
  for (const list of groups.values()) {
    list.sort((x, y) => compareByStatus(x.next, y.next) || x.name.localeCompare(y.name, 'ko'));
  }
  const cohortOrder = [...groups.keys()].sort((a, b) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return b.localeCompare(a, 'ko');
  });

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
          <h1 className={styles.h1}>캐릭터포지셔닝 관리</h1>
          <div className={styles.meta}>기수를 큰 틀로 두고, 각 기수 안에서 배우별 리서치와 1주차 분석 진행을 관리합니다.</div>
        </div>
        <div className={styles.topbarActions}>
          <Link href="/admin/inquiries" className={`${styles.btn} ${styles.ghost}`}>
            상담 문의{newInquiries > 0 && <em className={styles.countBadge}>{newInquiries}</em>}
          </Link>
          <form action={logout}>
            <button className={`${styles.btn} ${styles.ghost}`} type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <AdminTabs active="class" />

      <section className={styles.adminHub}>
        <div>
          <strong>운영 데이터 센터</strong>
          <p>문의·상담·AI 분석·광고비·등록·결제를 한 화면에서 확인합니다.</p>
        </div>
        <div className={styles.adminHubActions}>
          <Link href="/admin/analytics" className={`${styles.btn} ${styles.sm}`}>통합 대시보드</Link>
          <Link href="/admin/marketing" className={`${styles.btn} ${styles.ghost} ${styles.sm}`}>광고비 입력</Link>
          <Link href="/admin/funnel" className={`${styles.btn} ${styles.ghost} ${styles.sm}`}>등록·결제</Link>
        </div>
      </section>

      <form className={styles.searchForm} action="/admin" method="get">
        <input
          className={styles.searchInput}
          type="search"
          name="q"
          defaultValue={q}
          placeholder="배우 이름 또는 기수로 찾기"
          aria-label="배우 검색"
        />
        <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} type="submit">
          찾기
        </button>
        {q && (
          <Link href="/admin" className={styles.searchClear}>
            전체 보기
          </Link>
        )}
      </form>

      {q && (
        <p className={styles.blockHint}>
          &lsquo;{q}&rsquo; 검색 결과 {active.length}명 (전체 {all.length}명)
        </p>
      )}

      {active.length > 0 && (
        <div className={styles.summary}>
          {(['ready', 'collecting', 'running', 'done'] as ActorStatusKey[])
            .filter((k) => (summary.get(k) ?? 0) > 0)
            .map((k) => (
              <span key={k} className={`${styles.summaryItem} ${styles['st_' + k]}`}>
                {STATUS_SUMMARY_LABEL[k]} <b>{summary.get(k)}</b>
              </span>
            ))}
        </div>
      )}

      <AddActorForm />

      {active.length === 0 ? (
        <p className={styles.empty}>
          {q ? '검색 결과가 없습니다.' : '등록된 배우가 없습니다. 위에서 추가해주세요.'}
        </p>
      ) : (
        cohortOrder.map((cohort) => (
          <section key={cohort} className={styles.cohortGroup}>
            <div className={styles.cohortHead}>
              <h2 className={styles.cohortTitle}>{cohort}</h2>
              {cohort === UNASSIGNED ? (
                <span className={styles.cohortMeta}>
                  기수를 지정해야 주차를 기수 단위로 열 수 있습니다
                </span>
              ) : (
                <Link
                  href={`/admin/cohort/${encodeURIComponent(cohort)}`}
                  className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                >
                  주차 관리 ({openWeeksByCohort.get(cohort) ?? 0}/{WEEK_COUNT} 공개)
                </Link>
              )}
            </div>
            <div className={styles.cards}>
              {groups.get(cohort)!.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/${a.id}`}
                  className={`${styles.card} ${a.next.urgent ? styles.cardUrgent : ''}`}
                >
                  <div className={styles.cardHead}>
                    <strong>{a.name}</strong>
                    <span className={styles.meta}>
                      {[a.birthYear && `${a.birthYear}년생`, a.gender === 'female' ? '여' : '남']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>

                  <div className={`${styles.statusPill} ${styles['st_' + a.next.key]}`}>
                    {a.next.label}
                  </div>
                  <p className={styles.nextAction}>{a.next.action}</p>
                  <div className={styles.cardRows}>
                    {a.surveys
                      .filter((s) => s.type !== 'self')
                      .map((s) => (
                        <div key={s.type} className={styles.cardRow}>
                          <span>{CATEGORY_LABEL[s.type]}</span>
                          <span className={s.met ? styles.ok : styles.no}>
                            {s.n} / {s.minN}
                          </span>
                        </div>
                      ))}
                    <div className={styles.cardRow}>
                      <span>셀프 체크</span>
                      <span
                        className={
                          (a.surveys.find((s) => s.type === 'self')?.n ?? 0) > 0
                            ? styles.ok
                            : styles.no
                        }
                      >
                        {(a.surveys.find((s) => s.type === 'self')?.n ?? 0) > 0 ? '완료' : '미완료'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.weekDots}>
                    {Array.from({ length: WEEK_COUNT }, (_, i) => i + 1).map((w) => (
                      <span
                        key={w}
                        className={a.openWeeks.includes(w) ? styles.weekDotOn : styles.weekDotOff}
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
