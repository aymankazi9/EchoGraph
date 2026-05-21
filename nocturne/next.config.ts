import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        // App shell pages — network first with 3s timeout, fall back to cache
        urlPattern: /^https:\/\/.*\/(vault|session|unlock|setup|settings).*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'nocturne-pages',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 86400, // 1 day
          },
        },
      },
      {
        // Next.js static assets — cache-first (fingerprinted, safe to cache long)
        urlPattern: /\/_next\/static\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'nocturne-static',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 604800, // 7 days
          },
        },
      },
      {
        // Public assets (icons, manifest)
        urlPattern: /\/(icons|manifest\.json).*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'nocturne-assets',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 604800,
          },
        },
      },
      {
        // Supabase: never cache — encrypted blobs must always come from server
        urlPattern: /supabase\.co/,
        handler: 'NetworkOnly',
      },
      {
        // YouTube API: always network
        urlPattern: /youtube\.googleapis\.com/,
        handler: 'NetworkOnly',
      },
      {
        // Internal API routes: always network
        urlPattern: /\/api\//,
        handler: 'NetworkOnly',
      },
    ],
  },
})

const nextConfig: NextConfig = {
  // Empty turbopack config silences the "webpack config with no turbopack config" warning.
  // pdfjs-dist is browser-only and loaded lazily via dynamic import inside useEffect,
  // so Turbopack will not include it in the server bundle.
  turbopack: {},
  async redirects() {
    return [
      { source: '/faq', destination: '/help', permanent: false },
      { source: '/security-policy', destination: '/security#disclosure', permanent: false },
    ]
  },
  // Required for @ffmpeg/ffmpeg nested worker + SharedArrayBuffer support.
  // Note: COEP 'require-corp' is intentionally omitted here because it would
  // break future YouTube iframe embeds (Scholar tier). Add it once all
  // cross-origin resources include CORP headers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default withPWA(nextConfig)
