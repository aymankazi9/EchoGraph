import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Blog — EchoGraph',
}

export default function BlogPage() {
  return (
    <StubPage
      badge="soon"
      title="The EchoGraph blog"
      description="Thoughts on study science, encryption, and building tools for serious students. Coming soon."
    />
  )
}
