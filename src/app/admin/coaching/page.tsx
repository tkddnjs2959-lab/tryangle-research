import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listCoachingStudents } from '@/lib/admin-data';
import { CATEGORY_LABEL } from '@/lib/types';
import { WEEK_COUNT } from '@/lib/weeks';
import { logout, removeCoachingStudent, saveCoachingNote, unlinkCoaching } from '../actions';
import AdminTabs from '../AdminTabs';
import styles from '../admin.module.css';
import AddCoachingStudentForm from './AddCoachingStudentForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '1:1 매체연기 코칭 · 어드민', robots: { index: false, follow: false } };

export default async function CoachingAdminPage() {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const students = await listCoachingStudents();
  const active = students.filter((s) => s.status !== 'archived');

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
          <h1 className={styles.h1}>1:1 매체연기 코칭</h1>
        </div>
        <div className={styles.topbarActions}>
          <form action={logout}>
            <button className={`${styles.btn} ${styles.ghost}`} type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <AdminTabs active="coaching" />

      <AddCoachingStudentForm />

      {active.length === 0 ? (
        <p className={styles.empty}>등록된 학생이 없습니다. 위에서 추가해주세요.</p>
      ) : (
        <ul className={styles.respList}>
          {active.map((s) => (
            <li key={s.id} className={styles.resp}>
              <div className={styles.respHead}>
                <strong>{s.name}</strong>
                <span className={styles.meta}>
                  {[s.birthYear && `${s.birthYear}년생`, s.gender === 'female' ? '여' : '남', s.contact]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {s.actor && <span className={styles.linkTag}>퍼스널 브랜딩 연동</span>}
                <form action={removeCoachingStudent}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={styles.del} type="submit">
                    보관
                  </button>
                </form>
              </div>

              {s.actor && (
                <div className={styles.linkedBox}>
                  <div className={styles.linkedHead}>
                    <span className={styles.linkedTitle}>
                      {s.actor.cohort ?? '기수 미지정'} · {s.actor.name}
                    </span>
                    <div className={styles.linkedActions}>
                      <Link
                        href={`/admin/${s.actor.id}`}
                        className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                      >
                        퍼스널 브랜딩 상세
                      </Link>
                      <form action={unlinkCoaching}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className={styles.del} type="submit">
                          연동 해제
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className={styles.linkedRows}>
                    {s.actor.surveys
                      .filter((v) => v.type !== 'self')
                      .map((v) => (
                        <span key={v.type} className={styles.linkedStat}>
                          {CATEGORY_LABEL[v.type]}{' '}
                          <b className={v.met ? styles.ok : styles.no}>
                            {v.n}/{v.minN}
                          </b>
                        </span>
                      ))}
                    <span className={styles.linkedStat}>
                      공개 주차{' '}
                      <b className={s.actor.openWeeks.length > 0 ? styles.ok : styles.no}>
                        {s.actor.openWeeks.length}/{WEEK_COUNT}
                      </b>
                    </span>
                  </div>
                </div>
              )}
              <form action={saveCoachingNote} className={styles.noteForm}>
                <input type="hidden" name="id" value={s.id} />
                <textarea
                  className={styles.noteArea}
                  name="note"
                  defaultValue={s.note ?? ''}
                  placeholder="코칭 기록 · 메모"
                  rows={3}
                />
                <button className={`${styles.btn} ${styles.sm}`} type="submit">
                  메모 저장
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
