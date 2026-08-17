import InquiryForm from './InquiryForm';
import styles from './page.module.css';

export const metadata = { title: '상담 문의 · TRY앵글', description: 'TRY앵글 수강 및 퍼스널 리서치 상담 문의' };

export default function InquiryPage() {
  return <main className={styles.page}>
    <section className={styles.sheet}>
      <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
      <h1 className={styles.title}>상담 문의</h1>
      <p className={styles.lead}>수강 과정과 일정, 퍼스널 리서치에 대해 궁금한 점을 남겨주세요.<br />확인 후 운영팀이 안내드립니다.</p>
      <InquiryForm />
      <p className={styles.note}>입력하신 정보는 상담 안내 목적으로만 사용합니다.</p>
    </section>
  </main>;
}
