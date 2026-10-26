import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://appnocturne.com'

  const entries: Array<{ route: string; freq: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
    // Homepage
    { route: '',               freq: 'weekly',  priority: 1.0 },
    // Core marketing
    { route: '/about',         freq: 'monthly', priority: 0.8 },
    { route: '/changelog',     freq: 'weekly',  priority: 0.7 },
    { route: '/roadmap',       freq: 'monthly', priority: 0.5 },
    { route: '/blog',          freq: 'weekly',  priority: 0.6 },
    { route: '/contact',       freq: 'monthly', priority: 0.5 },
    { route: '/accessibility', freq: 'monthly', priority: 0.4 },
    // Discipline landing pages
    { route: '/for/pre-med',     freq: 'monthly', priority: 0.8 },
    { route: '/for/engineering', freq: 'monthly', priority: 0.8 },
    { route: '/for/law',         freq: 'monthly', priority: 0.8 },
    // Legal — indexed so users can find them; low crawl priority
    { route: '/privacy',   freq: 'yearly', priority: 0.3 },
    { route: '/terms',     freq: 'yearly', priority: 0.3 },
    { route: '/cookies',   freq: 'yearly', priority: 0.3 },
    { route: '/security',  freq: 'monthly', priority: 0.5 },
    { route: '/help',      freq: 'monthly', priority: 0.5 },
  ]

  return entries.map(({ route, freq, priority }) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: freq,
    priority,
  }))
}
