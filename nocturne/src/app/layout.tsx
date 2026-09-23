import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppleMeta } from '@/components/pwa/apple-meta'
import { ScrollManager } from '@/components/scroll-manager'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  metadataBase: new URL('https://appnocturne.com'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: "Nocturne — AI Study App That Predicts What's On Your Exam",
    template: '%s · Nocturne',
  },
  description:
    'Nocturne analyzes your lecture recordings, slides, and study guide with AI to surface the Red Zone — the exact terms your professor emphasized, ranked by exam likelihood. Zero-knowledge encrypted, free forever.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nocturne',
    startupImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    title: "Nocturne — AI Study App That Predicts What's On Your Exam",
    description:
      'Not a note-taker. Nocturne ranks lecture content by exam likelihood using AI emphasis detection — encrypted client-side, free to start.',
    siteName: 'Nocturne',
  },
  twitter: {
    card: 'summary',
    title: "Nocturne — AI Study App That Predicts What's On Your Exam",
    description:
      'AI-powered Red Zone scoring finds what your professor actually emphasized. Zero-knowledge encrypted. Free forever.',
  },
  icons: {
    icon: '/icon.svg',
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0F1117',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <head>
        <AppleMeta />
      </head>
      <body className="min-h-full">
        <ScrollManager />
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  )
}
