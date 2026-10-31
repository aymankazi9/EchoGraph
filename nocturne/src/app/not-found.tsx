import { ErrorPage } from '@/components/surgical/error-page'

export default function RootNotFound() {
  return (
    <ErrorPage
      code="404"
      replaceZeroWithMark
      headline="Page not found"
      body="The link may be broken or the page was moved."
      primary={{ label: 'Back to home', href: '/' }}
      secondary={{ label: 'Help Center', href: '/help' }}
    />
  )
}
