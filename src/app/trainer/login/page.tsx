import { redirect } from 'next/navigation';
import { trainerIdentity } from '@/lib/trainer-auth';
import { trainerLogin } from '../actions';
import styles from '../../admin/admin.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'트레이너 로그인 · JAUT 매체연기',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (await trainerIdentity()) redirect('/trainer');
  const params=await searchParams;
  return <main className={styles.loginPage}><div className={styles.loginBox}>
    <div className={styles.brand}>JAUT 매체연기</div><h1 className={styles.loginTitle}>트레이너 로그인</h1>
    {params.error && <p className={styles.error}>아이디 또는 비밀번호를 확인해 주세요.</p>}
    <form action={trainerLogin} className={styles.loginForm}>
      <label>아이디<input className={styles.input} name="loginId" autoComplete="username" required/></label>
      <label>비밀번호<input className={styles.input} name="password" type="password" autoComplete="current-password" required/></label>
      <button className={styles.btn}>로그인</button>
    </form>
  </div></main>;
}
