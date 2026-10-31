import { ErrorPage } from '@/components/surgical/error-page'

export default function AppNotFound() {
  return (
    <ErrorPage
      code="404"
      compact
      replaceZeroWithMark
      headline="Page not found"
      body="The link may be broken or the page was moved. Your vault is untouched."
      primary={{ label: 'Back to vault', href: '/vault' }}
      secondary={{ label: 'Help Center', href: '/help' }}
    />
  )
}
