/** @type {import('next').NextConfig} */
const nextConfig = {
  // 응답 페이지는 항상 최신 상태(잠김 여부)를 보여줘야 하므로 캐시하지 않는다.
  // 각 page.tsx 에서 dynamic = 'force-dynamic' 으로도 지정한다.
  poweredByHeader: false,
  async headers() {
    const adminSecurity = [
      { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://kauth.kakao.com https://kapi.kakao.com" },
    ];
    return [
      { source: '/admin/:path*', headers: adminSecurity },
      { source: '/:path*', headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ] },
    ];
  },
};

export default nextConfig;
