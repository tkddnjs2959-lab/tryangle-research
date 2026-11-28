import { redirect } from 'next/navigation';
import { currentAdminIdentity } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';
import AdminTabs from '../AdminTabs';
import { saveTrainerAccount } from './actions';
import styles from '../admin.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'계정 관리 · 어드민',robots:{index:false,follow:false}};
export default async function AccountsPage() {
  const identity=await currentAdminIdentity();
  if (!identity) redirect('/admin/login');
  if (!['owner','admin'].includes(identity.role)) redirect('/admin');
  const result=await db().from('trainer_accounts').select('id,login_id,display_name,teacher_name,active,created_at').order('created_at');
  if (result.error) throw new Error('계정을 조회하지 못했습니다.');
  const teachers=['이주아 T','김유리 T'];
  return <main className={styles.page}><header className={styles.topbar}><h1 className={styles.h1}>계정 관리</h1></header><AdminTabs active="accounts"/>
    <section className={styles.block}><h2>트레이너 계정 생성</h2><p>아이디는 영문 소문자·숫자·마침표·밑줄·하이픈 4~40자, 비밀번호는 12자 이상입니다. 비밀번호는 다시 표시되지 않습니다.</p>
      <form action={saveTrainerAccount} style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <input className={styles.input} name="loginId" placeholder="로그인 아이디" required minLength={4} maxLength={40}/>
        <input className={styles.input} name="displayName" placeholder="표시 이름" required/>
        <select className={styles.input} name="teacherName" required><option value="">선생님 선택</option>{teachers.map(t=><option key={t}>{t}</option>)}</select>
        <input className={styles.input} name="password" type="password" placeholder="초기 비밀번호" required minLength={12}/>
        <label><input type="checkbox" name="active" defaultChecked/>활성</label><button className={styles.btn}>계정 생성</button>
      </form>
    </section>
    <section className={styles.block}><h2>트레이너 계정</h2><p>담임 또는 부담임으로 배정된 학생만 트레이너 화면에서 열 수 있습니다. 비활성화·비밀번호 변경 시 기존 로그인은 종료됩니다.</p>
      {(result.data??[]).map(a=><form key={a.id} action={saveTrainerAccount} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #eadde5'}}>
        <input type="hidden" name="id" value={a.id}/>
        <label>아이디<input className={styles.input} name="loginId" defaultValue={a.login_id} required/></label>
        <label>표시 이름<input className={styles.input} name="displayName" defaultValue={a.display_name} required/></label>
        <label>담당 선생님<select className={styles.input} name="teacherName" defaultValue={a.teacher_name}>{teachers.map(t=><option key={t}>{t}</option>)}</select></label>
        <label>새 비밀번호<input className={styles.input} name="password" type="password" placeholder="변경할 때만 입력" minLength={12}/></label>
        <label><input type="checkbox" name="active" defaultChecked={a.active}/>활성</label><button className={styles.btn}>저장</button>
      </form>)}
    </section>
  </main>;
}
