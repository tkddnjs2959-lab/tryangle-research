import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import LoginForm from './LoginForm';
import { isGoogleAdminLoginEnabled } from '@/lib/admin-google-auth';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '어드민 · TRY앵글', robots: { index: false, follow: false } };

const GOOGLE_ERRORS: Record<string, string> = {
  config: 'Google 로그인 설정이 아직 완료되지 않았습니다.',
  invalid: 'Google 로그인 요청이 만료되었거나 올바르지 않습니다.',
  forbidden: 'Google 계정 연결 권한을 확인할 수 없습니다.',
  not_allowed: '허용 목록에 등록되지 않은 Google 계정입니다.',
  failed: 'Google 계정 확인에 실패했습니다. 다시 시도해주세요.',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ google_error?: string }> }) {
  if (await isLoggedIn()) redirect('/admin');
  const sp = await searchParams;

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginBox}>
        <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
        <h1 className={styles.loginTitle}>퍼스널 리서치 어드민</h1>
        {sp.google_error && <p className={styles.error}>{GOOGLE_ERRORS[sp.google_error] || GOOGLE_ERRORS.failed}</p>}
        <LoginForm googleEnabled={isGoogleAdminLoginEnabled()} />
      </div>
    </main>
  );
}
