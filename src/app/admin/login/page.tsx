import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import LoginForm from './LoginForm';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '어드민 · TRY앵글', robots: { index: false, follow: false } };

export default async function Page() {
  if (await isLoggedIn()) redirect('/admin');

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginBox}>
        <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
        <h1 className={styles.loginTitle}>퍼스널 리서치 어드민</h1>
        <LoginForm />
      </div>
    </main>
  );
}
