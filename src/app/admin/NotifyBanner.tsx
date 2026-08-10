import styles from './admin.module.css';

/**
 * 주차 공개 직후 카카오 알림이 몇 명에게 갔는지 알려준다.
 *
 * 공개 액션이 리다이렉트하면서 쿼리로 결과를 넘긴다.
 * 대표가 "열긴 열었는데 배우가 알까?" 를 화면에서 바로 알 수 있어야 한다.
 */
export default function NotifyBanner({
  params,
}: {
  params: { nweek?: string; nsent?: string; nskip?: string; nfail?: string };
}) {
  const week = Number(params.nweek);
  if (!Number.isInteger(week)) return null;

  const sent = Number(params.nsent) || 0;
  const skipped = Number(params.nskip) || 0;
  const failed = Number(params.nfail) || 0;

  const tone = failed > 0 ? styles.bannerWarn : sent > 0 ? styles.bannerOk : styles.bannerPlain;

  return (
    <div className={`${styles.banner} ${tone}`}>
      <strong>{week}주차를 공개했습니다.</strong>{' '}
      {sent > 0 && <>카카오 알림 {sent}명 발송. </>}
      {skipped > 0 && <>{skipped}명은 메시지 동의가 없어 건너뛰었습니다. </>}
      {failed > 0 && <>{failed}명은 발송에 실패했습니다. </>}
      {sent === 0 && failed === 0 && (
        <>알림을 받을 수 있는 배우가 없어 화면에만 공개되었습니다.</>
      )}
    </div>
  );
}
