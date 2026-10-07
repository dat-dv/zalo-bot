import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'https://bot.datintech.site';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/about', '/privacy', '/terms'].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));
}
