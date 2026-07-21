import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://appnocturne.com'

  const marketing = ['', '/pricing', '/about', '/blog', '/changelog', '/roadmap', '/contact', '/accessibility']
  const legal = ['/privacy', '/terms', '/cookies', '/security', '/help']

  return [...marketing, ...legal].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/blog' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.6,
  }))
}
