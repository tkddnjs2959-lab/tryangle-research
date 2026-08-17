import { getActorSession } from '@/lib/actor-session';
import { listPayableEnrollments } from '@/lib/checkout-data';
import CheckoutButton from './CheckoutButton';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '수강료 결제 · TRY앵글', robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const session = await getActorSession();
  if (!session) return <main className={styles.page}><div className={styles.sheet}><div className={styles.notice}><h1 className={styles.noticeTitle}>로그인이 필요합니다</h1><p className={styles.noticeBody}>수강생 본인 확인 후 결제할 수 있습니다. 진행 현황 페이지에서 카카오 로그인 후 다시 접속해주세요.</p></div></div></main>;
  const enrollments = await listPayableEnrollments(session.actorId);
  const enabled = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
  return <main className={styles.page}><div className={styles.sheet}><div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div><h1 className={styles.title}>수강료 결제</h1><p className={styles.lead}>등록된 수강 과정의 결제 금액을 확인한 뒤 결제해주세요.</p>{enrollments.length === 0 ? <div className={styles.notice}><h2 className={styles.noticeTitle}>결제할 과정이 없습니다</h2><p className={styles.noticeBody}>담당자가 상품명과 수강료를 등록하면 이 화면에 결제 버튼이 표시됩니다.</p></div> : enrollments.map((enrollment) => <section className={styles.card} key={enrollment.id}><div className={styles.cardHead}><div><div className={styles.product}>{enrollment.productName}</div><div className={styles.cohort}>{enrollment.cohort ?? '기수 미지정'}</div></div><strong className={styles.amount}>{enrollment.amount.toLocaleString('ko-KR')}원</strong></div><CheckoutButton enrollmentId={enrollment.id} enabled={enabled} /></section>)}<footer className={styles.foot}>결제 금액은 담당자가 등록한 수강료를 기준으로 합니다.<br />결제 관련 문의는 TRY앵글 운영팀에 연락해주세요.</footer></div></main>;
}
