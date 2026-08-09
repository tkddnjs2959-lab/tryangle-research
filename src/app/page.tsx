export const metadata = { robots: { index: false, follow: false } };

/**
 * 루트는 아무것도 안내하지 않는다.
 * 이 서비스에 정문은 없다 — 링크를 받은 사람만 들어온다.
 */
export default function Home() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '96px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: 1.2,
          fontWeight: 700,
          color: 'var(--sub)',
        }}
      >
        ARTIST BRANDING COMPANY TRY앵글
      </div>
      <p
        style={{
          marginTop: 20,
          fontSize: 14.5,
          lineHeight: 1.7,
          color: 'var(--sub)',
        }}
      >
        전달받으신 링크로 접속해주세요.
      </p>
    </main>
  );
}
