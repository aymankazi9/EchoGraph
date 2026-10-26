import type { MetadataRoute } from 'next'

// App-only paths that should never be indexed.
const APP_PATHS = [
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
  '/beta-guide',
  '/checkout',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule for all crawlers.
      {
        userAgent: '*',
        allow: '/',
        disallow: APP_PATHS,
      },
      // AI crawlers — explicitly allowed so no ambiguity if '*' ever changes.
      // They still cannot reach authenticated app routes.
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: APP_PATHS,
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: APP_PATHS,
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: APP_PATHS,
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: APP_PATHS,
      },
    ],
    sitemap: 'https://appnocturne.com/sitemap.xml',
  }
}
