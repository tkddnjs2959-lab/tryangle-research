import { redirect } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-auth';
import { listActors, listInquiries } from '@/lib/admin-data';
import { listFunnelRecords } from '@/lib/funnel-data';
import { addEnrollment, addPayment, logout } from '../actions';
import AdminTabs from '../AdminTabs';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '등록·결제 퍼널 · 관리자', robots: { index: false, follow: false } };

const statusLabels = { applied: '신청', enrolled: '등록', paused: '보류', completed: '수료', cancelled: '취소' };
const paymentLabels = { pending: '대기', paid: '결제완료', refunded: '환불', void: '무효' };

export default async function FunnelPage() {
  if (!(await isLoggedIn())) redirect('/admin/login');
  const [actors, inquiries, records] = await Promise.all([listActors(), listInquiries(), listFunnelRecords()]);
  const actorNames = new Map(actors.map((item) => [item.id, item.name]));
  const inquiryNames = new Map(inquiries.map((item) => [item.id, item.name]));

  return <main className={styles.page}>
    <header className={styles.topbar}><div><div className={styles.brand}>TRYANGLE DATA CENTER</div><h1 className={styles.h1}>등록·결제 퍼널</h1><div className={styles.meta}>문의와 상담 이후의 등록 및 결제를 연결하면 CPL·CPA·ROAS 계산이 가능해집니다.</div></div><form action={logout}><button className={`${styles.btn} ${styles.ghost}`} type="submit">로그아웃</button></form></header>
    <AdminTabs active="funnel" />
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>수강등록 연결</h2>
      <p className={styles.blockHint}>문의 또는 배우 중 하나를 선택해 등록 상태와 유입 정보를 저장합니다. 문의를 선택하면 비어 있는 유입정보가 문의 기록에서 자동으로 상속됩니다. 이름이 같아도 ID 기준으로 연결됩니다.</p>
      <form action={addEnrollment} className={styles.funnelForm}>
        <select className={styles.input} name="inquiryId" defaultValue=""><option value="">문의 선택 (선택)</option>{inquiries.filter((item) => item.status !== 'archived').map((item) => <option key={item.id} value={item.id}>{item.name} · {item.source}</option>)}</select>
        <select className={styles.input} name="actorId" defaultValue=""><option value="">배우 선택 (선택)</option>{actors.filter((item) => item.status !== 'archived').map((item) => <option key={item.id} value={item.id}>{item.name}{item.cohort ? ` · ${item.cohort}` : ''}</option>)}</select>
        <input className={styles.input} name="cohort" placeholder="기수" />
        <input className={styles.input} name="productName" placeholder="상품명" />
        <input className={styles.input} name="amount" type="number" min="0" step="1000" placeholder="수강료(원)" />
        <select className={styles.input} name="status" defaultValue="enrolled">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input className={styles.input} name="enrolledAt" type="date" />
        <input className={styles.input} name="source" placeholder="source" />
        <input className={styles.input} name="medium" placeholder="medium" />
        <input className={styles.input} name="campaign" placeholder="campaign" />
        <input className={styles.input} name="content" placeholder="content" />
        <input className={styles.input} name="note" placeholder="메모" />
        <button className={styles.btn} type="submit">등록 연결 저장</button>
      </form>
    </section>
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>등록 목록 <em className={styles.countBadge}>{records.length}</em></h2>
      {records.length === 0 ? <p className={styles.empty}>아직 등록 데이터가 없습니다.</p> : <ul className={styles.funnelList}>{records.map((record) => {
        const totalPaid = record.payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
        return <li key={record.id} className={styles.funnelItem}>
          <div className={styles.respHead}><strong>{record.actorId ? actorNames.get(record.actorId) : '배우 미연결'} · {record.inquiryId ? inquiryNames.get(record.inquiryId) : '문의 미연결'}</strong><span className={styles.meta}>{statusLabels[record.status]} · {record.cohort ?? '기수 미지정'}</span></div>
          <div className={styles.consultMeta}>상품: {record.productName ?? '미지정'} · 수강료 {record.amount === null ? '미지정' : `${record.amount.toLocaleString('ko-KR')}원`} · 유입: {[record.source, record.medium, record.campaign].filter(Boolean).join(' / ') || '미입력'} · 결제완료 {totalPaid.toLocaleString('ko-KR')}원</div>
          <form action={addPayment} className={styles.paymentForm}><input type="hidden" name="enrollmentId" value={record.id} /><input className={styles.input} name="amount" type="number" min="0" step="1000" placeholder="결제 금액" required /><input className={styles.input} name="paidAt" type="date" /><select className={styles.input} name="status" defaultValue="paid">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input className={styles.input} name="paymentType" placeholder="결제 유형" /><button className={`${styles.btn} ${styles.sm}`} type="submit">결제 저장</button></form>
          {record.payments.length > 0 && <div className={styles.paymentHistory}>{record.payments.map((payment) => <span key={payment.id}>{payment.amount.toLocaleString('ko-KR')}원 · {paymentLabels[payment.status]}{payment.paidAt ? ` · ${new Date(payment.paidAt).toLocaleDateString('ko-KR')}` : ''}</span>)}</div>}
        </li>;
      })}</ul>}
    </section>
  </main>;
}
