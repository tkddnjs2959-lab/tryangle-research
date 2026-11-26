import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 응답 페이지는 항상 최신 상태(잠김 여부)를 보여줘야 하므로 캐시하지 않는다.
  // 각 page.tsx 에서 dynamic = 'force-dynamic' 으로도 지정한다.
  poweredByHeader: false,
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src');
    return config;
  },
};

export default nextConfig;
