import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/vault',
        '/session',
        '/setup',
        '/unlock',
        '/auth',
        '/api',
        '/login',
        '/billing',
        '/community',
        '/momentum',
        '/offline',
      ],
    },
    sitemap: 'https://appnocturne.com/sitemap.xml',
  }
}
