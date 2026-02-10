import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/dashboard/', '/sign-in/', '/sign-up/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
