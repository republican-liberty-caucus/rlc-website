/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
      {
        source: '/scorecards/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/chapters', destination: '/charters', permanent: true },
      { source: '/chapters/:slug', destination: '/charters/:slug', permanent: true },
      { source: '/admin/chapters', destination: '/admin/charters', permanent: true },
      { source: '/admin/chapters/:path*', destination: '/admin/charters/:path*', permanent: true },
      { source: '/api/v1/chapters', destination: '/api/v1/charters', permanent: true },
      { source: '/api/v1/chapters/:path*', destination: '/api/v1/charters/:path*', permanent: true },
      { source: '/api/v1/admin/chapters/:path*', destination: '/api/v1/admin/charters/:path*', permanent: true },
    ];
  },
};

module.exports = nextConfig;
