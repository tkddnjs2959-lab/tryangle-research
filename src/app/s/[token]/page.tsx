import { getProgressByToken } from '@/lib/research';
import { AUDIENCE, CATEGORY_LABEL } from '@/lib/types';
import ShareBox from './ShareBox';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '퍼스널 리서치 진행 현황 · TRY앵글',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await getProgressByToken(token);

  if (!p) {
    return (
      <main className={styles.page}>
        <div className={styles.notice}>
          <h1 className={styles.noticeTitle}>링크를 찾을 수 없습니다</h1>
          <p className={styles.noticeBody}>
            주소가 잘못되었거나 삭제된 페이지입니다. 담당자에게 문의해주세요.
          </p>
        </div>
      </main>
    );
  }

  const self = p.surveys.find((s) => s.type === 'self');
  const outgoing = p.surveys.filter((s) => s.type !== 'self');

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
        <h1 className={styles.title}>{p.actorName} 님의 퍼스널 리서치</h1>
      </header>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>진행 현황</h2>

        {outgoing.map((s) => (
          <div key={s.type} className={styles.gauge}>
            <div className={styles.gaugeHead}>
              <span className={styles.gaugeLabel}>
                {CATEGORY_LABEL[s.type]}
                <em>{AUDIENCE[s.type]}</em>
              </span>
              <span className={`${styles.gaugeNum} ${s.met ? styles.met : ''}`}>
                {s.n} / {s.minN}
                {s.met && <b>충족</b>}
              </span>
            </div>
            <div className={styles.dots}>
              {Array.from({ length: Math.max(s.minN, s.n) }, (_, i) => (
                <span key={i} className={i < s.n ? styles.dotOn : styles.dotOff} />
              ))}
            </div>
          </div>
        ))}

        <div className={styles.selfRow}>
          <span className={styles.selfLabel}>셀프 체크</span>
          {self && self.n > 0 ? (
            <span className={styles.done}>완료</span>
          ) : self ? (
            <a className={styles.selfBtn} href={`/r/${self.token}`}>
              지금 체크하기
            </a>
          ) : (
            <span className={styles.todo}>미완료</span>
          )}
        </div>
      </section>

      <ShareBox actorName={p.actorName} surveys={outgoing} />

      <footer className={styles.foot}>
        응답 내용은 이 화면에 표시되지 않습니다.
        <br />
        결과는 검수 후 담당자가 직접 전달드립니다.
      </footer>
    </main>
  );
}
