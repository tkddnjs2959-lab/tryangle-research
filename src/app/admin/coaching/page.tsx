import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listCoachingStudents } from '@/lib/admin-data';
import { logout, removeCoachingStudent, saveCoachingNote } from '../actions';
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
                <form action={removeCoachingStudent}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={styles.del} type="submit">
                    보관
                  </button>
                </form>
              </div>
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
