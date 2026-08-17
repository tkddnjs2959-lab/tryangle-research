import Link from 'next/link';
import styles from '../page.module.css';

export const metadata = { title: '결제 실패 · TRY앵글', robots: { index: false, follow: false } };

export default function CheckoutFail() { return <main className={styles.page}><div className={styles.sheet}><div className={styles.notice}><h1 className={styles.noticeTitle}>결제가 완료되지 않았습니다</h1><p className={styles.noticeBody}>결제는 승인되지 않았습니다. 다시 시도하거나 운영팀에 문의해주세요.</p><Link href="/checkout" className={styles.payButton}>결제 화면으로 돌아가기</Link></div></div></main>; }
