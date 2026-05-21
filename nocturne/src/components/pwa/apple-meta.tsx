// Apple-specific PWA meta tags not covered by Next.js metadata API.
// Placed inside <head> in the root layout.
export function AppleMeta() {
  return (
    <>
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Nocturne" />
      <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    </>
  )
}
