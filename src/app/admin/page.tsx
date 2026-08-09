import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { countNewInquiries, listActors } from '@/lib/admin-data';
import { CATEGORY_LABEL } from '@/lib/types';
import { logout } from './actions';
import AddActorForm from './AddActorForm';
import AdminTabs from './AdminTabs';
import styles from './admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '배우 목록 · 어드민', robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const [actors, newInquiries] = await Promise.all([listActors(), countNewInquiries()]);
  const active = actors.filter((a) => a.status !== 'archived');

  const UNASSIGNED = '기수 미지정';
  const groups = new Map<string, typeof active>();
  for (const a of active) {
    const key = a.cohort || UNASSIGNED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
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
          <h1 className={styles.h1}>배우 목록</h1>
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

      <AddActorForm />

      {active.length === 0 ? (
        <p className={styles.empty}>등록된 배우가 없습니다. 위에서 추가해주세요.</p>
      ) : (
        cohortOrder.map((cohort) => (
          <section key={cohort} className={styles.cohortGroup}>
            <h2 className={styles.cohortTitle}>{cohort}</h2>
            <div className={styles.cards}>
              {groups.get(cohort)!.map((a) => (
                <Link key={a.id} href={`/admin/${a.id}`} className={styles.card}>
                  <div className={styles.cardHead}>
                    <strong>{a.name}</strong>
                    <span className={styles.meta}>
                      {[a.birthYear && `${a.birthYear}년생`, a.gender === 'female' ? '여' : '남']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
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
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
