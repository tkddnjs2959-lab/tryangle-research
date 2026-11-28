import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listCoachingStudents } from '@/lib/admin-data';
import { db } from '@/lib/supabase';
import { logout } from '../actions';
import AdminTabs from '../AdminTabs';
import StudentDetails from './StudentDetails';
import styles from '../admin.module.css';
import AddCoachingStudentForm from './AddCoachingStudentForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '1:1 매체연기 코칭 · 어드민', robots: { index: false, follow: false } };

export default async function CoachingAdminPage({ searchParams }: { searchParams: Promise<{ gender?: string; age?: string; page?: string; q?: string }> }) {
  if (!(await isLoggedIn())) redirect('/admin/login');

  const params = await searchParams;
  const gender = params.gender === 'female' || params.gender === 'male' ? params.gender : undefined;
  const age = ['under20', '20s', '30s', '40plus', 'unknown'].includes(params.age ?? '')
    ? params.age as 'under20' | '20s' | '30s' | '40plus' | 'unknown'
    : undefined;
  const query = (params.q ?? '').trim().slice(0, 80);
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await listCoachingStudents({ gender, age, page, query });
  const active = result.students;
  const ids = active.map(student => student.id);
  const starts = ids.length ? await db().from('lesson_sessions').select('student_id, lesson_date').in('student_id', ids).order('lesson_date', { ascending: true }).limit(10000) : { data: [], error: null };
  if (starts.error) throw new Error('수강 시작일을 조회하지 못했습니다.');
  const startDates = new Map<string, string>();
  for (const row of starts.data ?? []) if (!startDates.has(row.student_id)) startDates.set(row.student_id, row.lesson_date);
  const consultationResult = ids.length ? await db().from('coaching_consultations').select('id, student_id, consultation_date, consultation_time, status, teacher, note, follow_up_date, next_action').in('student_id', ids).order('consultation_date', { ascending: false }).limit(3000) : { data: [], error: null };
  if (consultationResult.error) throw new Error('상담 기록을 조회하지 못했습니다.');
  const consultationsByStudent = new Map<string, typeof consultationResult.data>();
  for (const row of consultationResult.data ?? []) consultationsByStudent.set(row.student_id, [...(consultationsByStudent.get(row.student_id) ?? []), row]);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

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
        <label>학생 검색 <input className={styles.input} type="search" name="q" placeholder="이름 검색" defaultValue={query} /></label>
        <input type="hidden" name="page" value="1" />
        <button className={styles.btn} type="submit">적용</button><span>{result.total}명</span>
      </form>

      {active.length === 0 ? (
        <p className={styles.empty}>등록된 학생이 없습니다. 위에서 추가해주세요.</p>
      ) : (
        <ul className={styles.respList}>
          {active.map((s) => (
            <li key={s.id} className={styles.resp}>
              <div className={styles.respHead}>
                <StudentDetails student={s} consultations={consultationsByStudent.get(s.id) ?? []} />
                
                <span className={styles.meta}>
                  {[s.birthYear && `${s.birthYear}년생`, s.gender === 'female' ? '여' : '남', s.contact]
                    .concat(s.residence ? [`사는 곳 ${s.residence}`] : [])
                    .concat(s.school ? [s.school] : [])
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className={styles.meta}>수강 시작 {s.firstStartDate ?? startDates.get(s.id) ?? '미배정'} · 월 수강료 {s.monthlyTuition === null ? '미설정' : s.monthlyTuition.toLocaleString('ko-KR') + '원'}</span>
                {s.actor && <span className={styles.linkTag}>퍼스널 브랜딩 연동</span>}
              </div>

              <div className={styles.studentActions}>
                {s.actor && <Link href={`/admin/${s.actor.id}`} className={styles.back}>연동 상세</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 && <nav className={styles.tabs} aria-label="학생 목록 페이지">
        {page > 1 && <Link className={styles.tab} href={{ pathname: '/admin/coaching', query: { gender, age, q: query, page: page - 1 } }}>이전</Link>}
        <span aria-current="page" className={`${styles.tab} ${styles.tabOn}`}>{page} / {pageCount}</span>
        {page < pageCount && <Link className={styles.tab} href={{ pathname: '/admin/coaching', query: { gender, age, q: query, page: page + 1 } }}>다음</Link>}
      </nav>}
    </main>
  );
}
