import { cookies } from 'next/headers';
import { getSurveyByToken } from '@/lib/research';
import { GUIDE } from '@/lib/types';
import ResearchForm from './ResearchForm';
import styles from './page.module.css';

// 잠김 여부가 실시간으로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  // 배우 이름은 제목에 넣지 않는다. 링크 미리보기로 이름이 새지 않게.
  return { title: '퍼스널 리서치 · TRY앵글', robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const survey = await getSurveyByToken(token);

  if (!survey) {
    return (
      <Notice
        title="링크를 찾을 수 없습니다"
        body="주소가 잘못되었거나 삭제된 리서치입니다. 링크를 보내주신 분께 다시 확인해주세요."
      />
    );
  }

  // 이 브라우저에서 이미 제출했는지 (쿠키)
  const jar = await cookies();
  if (jar.get(`done_${token}`)?.value === '1') {
    return (
      <Notice
        title="이미 참여해주셨습니다"
        body="소중한 시간 내주셔서 감사합니다. 응답은 정상적으로 저장되었습니다."
      />
    );
  }

  if (!survey.isOpen) {
    const body =
      survey.closedReason === 'expired'
        ? '응답 기간이 종료되었습니다. 참여를 원하셨다면 링크를 보내주신 분께 문의해주세요.'
        : '필요한 인원이 모두 모여 마감되었습니다. 관심 가져주셔서 감사합니다.';
    return <Notice title="마감된 리서치입니다" body={body} />;
  }

  const guide = GUIDE[survey.type];
  const fill = (s: string) => s.replaceAll('{name}', survey.actorName);

  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
          <h1 className={styles.title}>{guide.title}</h1>
          <p className={styles.lead}>{fill(guide.lead)}</p>
          <ul className={styles.points}>
            {guide.points.map((p, i) => (
              <li key={i}>{fill(p)}</li>
            ))}
          </ul>
        </header>

        <ResearchForm survey={survey} />
      </div>

      <footer className={styles.foot}>
        응답은 익명으로 처리되며, 누가 어떤 키워드를 선택했는지는
        <br />
        본인에게 전달되지 않습니다.
      </footer>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        <div className={styles.notice}>
          <h1 className={styles.noticeTitle}>{title}</h1>
          <p className={styles.noticeBody}>{body}</p>
        </div>
      </div>
      <footer className={styles.foot}>ⓒ Artist Branding Company TRY앵글</footer>
    </main>
  );
}
