import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '퍼스널 리서치 · TRY앵글',
  // 응답 링크가 검색에 잡히면 안 된다.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // TRY앵글 연한 스카이블루. 모바일 브라우저 주소창·탭 색이 이 값으로 칠해진다.
  themeColor: '#BFDFF2',
  // maximumScale 을 막지 않는다 — 확대해서 읽어야 하는 분들이 있다.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 말풍선 렌더용 한글 웹폰트 (어드민 검수 화면) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&family=Gaegu:wght@700&family=Nanum+Pen+Script&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
