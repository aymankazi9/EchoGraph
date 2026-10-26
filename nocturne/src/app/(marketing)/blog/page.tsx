import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Blog — Nocturne',
  description: 'Thoughts on study science, encryption, and building tools for serious students.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog — Nocturne',
    description: 'Thoughts on study science, encryption, and building tools for serious students.',
    url: 'https://appnocturne.com/blog',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — Nocturne',
    description: 'Thoughts on study science, encryption, and building tools for serious students.',
  },
}

export default function BlogPage() {
  return (
    <StubPage
      badge="soon"
      title="The Nocturne blog"
      description="Thoughts on study science, encryption, and building tools for serious students. Coming soon."
    />
  )
}
