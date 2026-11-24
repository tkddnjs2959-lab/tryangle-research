import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listCoachingStudents } from '@/lib/admin-data';
import { logout, removeCoachingStudent } from '../actions';
import AdminTabs from '../AdminTabs';
import ConfirmButton from '../ConfirmButton';
import styles from '../admin.module.css';
import AddCoachingStudentForm from './AddCoachingStudentForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '1:1 매체연기 코칭 · 어드민', robots: { index: false, follow: false } };

export default async function CoachingAdminPage({ searchParams }: { searchParams: Promise<{ gender?: string; age?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const students = await listCoachingStudents();
  const { gender, age } = await searchParams;
  const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));
  const active = students.filter((s) => {
    if (s.status === 'archived') return false;
    if ((gender === 'female' || gender === 'male') && s.gender !== gender) return false;
    if (!age || age === 'all') return true;
    const yy = s.name.match(/\((\d{2})\)$/)?.[1];
    const birth = s.birthYear ?? (yy ? (Number(yy) <= year % 100 ? 2000 : 1900) + Number(yy) : null);
    if (!birth) return age === 'unknown';
    const years = year - birth;
    return age === 'under20' ? years < 20 : age === '20s' ? years >= 20 && years < 30
      : age === '30s' ? years >= 30 && years < 40 : age === '40plus' ? years >= 40 : false;
  });

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.brand}>JAUT 매체연기</div>
          <h1 className={styles.h1}>학생·등록</h1>
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
      <form action="/admin/coaching" className={styles.studentFilters}>
        <label>성별 <select name="gender" defaultValue={gender ?? 'all'}><option value="all">전체</option><option value="female">여성</option><option value="male">남성</option></select></label>
        <label>나이 <select name="age" defaultValue={age ?? 'all'}><option value="all">전체</option><option value="under20">20세 미만</option><option value="20s">20대</option><option value="30s">30대</option><option value="40plus">40세 이상</option><option value="unknown">나이 미상</option></select></label>
        <button className={styles.btn} type="submit">적용</button><span>{active.length}명</span>
      </form>

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
                    .concat(s.residence ? [`사는 곳 ${s.residence}`] : [])
                    .concat(s.school ? [s.school] : [])
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {s.actor && <span className={styles.linkTag}>퍼스널 브랜딩 연동</span>}
              </div>

              <div className={styles.studentActions}>
                {s.actor && <Link href={`/admin/${s.actor.id}`} className={styles.back}>연동 상세</Link>}
                <form action={removeCoachingStudent}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmButton className={styles.del} message={`${s.name} 학생을 목록에서 삭제할까요? 기록은 보존됩니다.`}>삭제</ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
