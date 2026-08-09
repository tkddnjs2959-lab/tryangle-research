import { getActorAccountById } from '@/lib/actor-account';
import { getActorSession } from '@/lib/actor-session';
import { logoutActor } from './actions';
import ActorProfileForm from './ActorProfileForm';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '배우 정보 등록 · TRY앵글', robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  invalid_token: '유효하지 않은 배우 링크입니다. 담당자에게 다시 요청해주세요.',
  invalid_state: '로그인 요청이 만료되었습니다. 진행 현황 링크에서 다시 시도해주세요.',
  invalid_actor: '배우 정보를 찾을 수 없습니다. 담당자에게 문의해주세요.',
  kakao_already_linked: '이미 다른 배우에게 연결된 카카오 계정입니다. 담당자에게 문의해주세요.',
};

export default async function ActorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getActorSession();
  const errorKey = (await searchParams).error;
  const error = errorKey ? ERRORS[errorKey] ?? decodeURIComponent(errorKey) : null;

  if (!session) {
    return (
      <main className={styles.page}>
        <section className={styles.box}>
          <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
          <h1 className={styles.title}>배우 정보 등록</h1>
          {error && <p className={styles.error}>{error}</p>}
          <p className={styles.body}>
            배우별 진행 현황 링크에서 카카오톡 로그인을 시작해주세요.
            <br />
            최초 1회 로그인 후 이 화면에서 정보를 등록할 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  const actor = await getActorAccountById(session.actorId);
  if (!actor || actor.kakaoUserId !== session.kakaoUserId) {
    return (
      <main className={styles.page}>
        <section className={styles.box}>
          <h1 className={styles.title}>로그인 정보 확인 필요</h1>
          <p className={styles.body}>담당자에게 다시 링크를 요청해주세요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.box}>
        <div className={styles.brand}>ARTIST BRANDING COMPANY TRY앵글</div>
        <h1 className={styles.title}>{actor.name} 님 정보 등록</h1>
        <p className={styles.body}>
          카카오 계정 연결이 완료되었습니다.
          {actor.profile?.kakaoNickname && (
            <>
              <br />
              연결된 카카오 닉네임: {actor.profile.kakaoNickname}
            </>
          )}
        </p>
        <ActorProfileForm
          name={actor.profile?.name || actor.name}
          phone={actor.profile?.phone ?? ''}
          memo={actor.profile?.memo ?? ''}
        />
        <form action={logoutActor} className={styles.logoutForm}>
          <button className={styles.ghostBtn} type="submit">
            로그아웃
          </button>
        </form>
      </section>
    </main>
  );
}
