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
      // Chapters → Charters rename
      { source: '/chapters', destination: '/charters', permanent: true },
      { source: '/chapters/:slug', destination: '/charters/:slug', permanent: true },
      { source: '/admin/chapters', destination: '/admin/charters', permanent: true },
      { source: '/admin/chapters/:path*', destination: '/admin/charters/:path*', permanent: true },
      { source: '/api/v1/chapters', destination: '/api/v1/charters', permanent: true },
      { source: '/api/v1/chapters/:path*', destination: '/api/v1/charters/:path*', permanent: true },
      { source: '/api/v1/admin/chapters/:path*', destination: '/api/v1/admin/charters/:path*', permanent: true },

      // WordPress page slug → new site path (SEO preservation)
      { source: '/bylaws', destination: '/about/bylaws', permanent: true },
      { source: '/caucus-rules', destination: '/about/bylaws', permanent: true },
      { source: '/principles', destination: '/about/principles', permanent: true },
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
      { source: '/committees', destination: '/about/committees', permanent: true },
      { source: '/speakers-bureau', destination: '/about/speakers', permanent: true },
      { source: '/officers', destination: '/about/officers', permanent: true },
      { source: '/history', destination: '/about/history', permanent: true },

      // WordPress category/tag archives → blog
      { source: '/category/:slug', destination: '/blog', permanent: true },
      { source: '/tag/:slug', destination: '/blog', permanent: true },
      { source: '/page/:num', destination: '/blog', permanent: true },

      // WordPress admin/feed URLs
      { source: '/wp-admin', destination: '/admin', permanent: false },
      { source: '/wp-login.php', destination: '/sign-in', permanent: false },
      { source: '/feed', destination: '/feed.xml', permanent: true },
    ];
  },
};

module.exports = nextConfig;
