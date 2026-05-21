import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Blog — Nocturne',
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
