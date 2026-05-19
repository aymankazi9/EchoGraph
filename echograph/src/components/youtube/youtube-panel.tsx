'use client'

// YouTube search panel — overlays the PDF pane, slides in from the right.
// DESIGN_SYSTEM.md §7: x: 360 → 0 open, 0 → 360 close, duration.standard, ease.out.
// Four states: dormant (no key), prompt consent, searching, empty results.

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Lock, SearchX } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'
import { getYouTubeApiKey } from '@/lib/youtube/config'
import { ConsentModal } from './consent-modal'
import { VideoCard } from './video-card'
import { CaptionInput } from './caption-input'
import type { Flashcard } from '@/lib/scoring/flashcard-generator'

const panelVariants = {
  hidden: { x: 360, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
  exit: {
    x: 360,
    opacity: 0,
    transition: { duration: 0.2, ease: [0.4, 0.0, 1.0, 1.0] as [number, number, number, number] },
  },
}

interface Props {
  onNewFlashcards: (cards: Flashcard[]) => void
}

export function YouTubePanel({ onNewFlashcards }: Props) {
  const keywords = useSessionStore((s) => s.keywords)
  const youtubeConsentGranted = useSessionStore((s) => s.youtubeConsentGranted)
  const youtubeResults = useSessionStore((s) => s.youtubeResults)
  const youtubePanelOpen = useSessionStore((s) => s.youtubePanelOpen)
  const grantYoutubeConsent = useSessionStore((s) => s.grantYoutubeConsent)
  const setYoutubeResults = useSessionStore((s) => s.setYoutubeResults)
  const setYoutubePanelOpen = useSessionStore((s) => s.setYoutubePanelOpen)

  const [showConsent, setShowConsent] = useState(false)
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [quotaHit, setQuotaHit] = useState(false)

  const redZoneKeywords = keywords.filter((k) => k.zone === 'red')
  const apiKey = getYouTubeApiKey()

  const handleClose = useCallback(() => {
    setYoutubePanelOpen(false)
  }, [setYoutubePanelOpen])

  const toggleKeyword = useCallback((term: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev)
      if (next.has(term)) next.delete(term)
      else next.add(term)
      return next
    })
  }, [])

  const handleSearch = useCallback(async () => {
    if (searching || selectedKeywords.size === 0) return
    setSearching(true)
    setQuotaHit(false)
    setYoutubeResults([])

    try {
      const { searchMultipleKeywords } = await import('@/lib/youtube/search')
      const results = await searchMultipleKeywords([...selectedKeywords])
      if (results === null) {
        setQuotaHit(true)
      } else {
        setYoutubeResults(results)
      }
    } catch (e) {
      console.error('[youtube-panel] search error:', e)
    } finally {
      setSearching(false)
    }
  }, [searching, selectedKeywords, setYoutubeResults])

  const handleConsentAllow = useCallback(() => {
    grantYoutubeConsent()
    setShowConsent(false)
  }, [grantYoutubeConsent])

  const handleConsentDeny = useCallback(() => {
    setShowConsent(false)
  }, [])

  return (
    <>
      <ConsentModal
        open={showConsent}
        onAllow={handleConsentAllow}
        onDeny={handleConsentDeny}
      />

      <AnimatePresence>
        {youtubePanelOpen && (
          <motion.div
            key="youtube-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-0 bottom-0 w-[360px] bg-bg-elevated border-l border-border-default flex flex-col z-10 shadow-md overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
              <span className="text-label font-medium text-text-primary">YouTube</span>
              <button
                type="button"
                onClick={handleClose}
                className="text-text-tertiary hover:text-text-secondary transition-colors"
                aria-label="Close YouTube panel"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4">

              {/* State a: API key absent */}
              {!apiKey && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <Lock size={32} strokeWidth={1.25} className="text-text-tertiary" />
                  <p className="text-body-sm text-text-secondary">
                    YouTube search is not configured. Add a YouTube API key to activate.
                  </p>
                  <p className="text-caption text-text-tertiary">Available in Scholar tier</p>
                </div>
              )}

              {/* State b: API key present, consent not yet granted */}
              {apiKey && !youtubeConsentGranted && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-bg-subtle flex items-center justify-center">
                    {/* Play triangle via SVG */}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 2L14 8L4 14V2Z" fill="#8B97AD" />
                    </svg>
                  </div>
                  <p className="text-body-sm text-text-secondary max-w-[240px]">
                    Search YouTube for your Red Zone keywords
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowConsent(true)}
                    className="h-9 px-5 rounded-btn bg-teal-300 text-text-inverse text-body font-medium hover:bg-teal-400 transition-colors"
                  >
                    Enable YouTube search
                  </button>
                </div>
              )}

              {/* State c: consent granted */}
              {apiKey && youtubeConsentGranted && (
                <div className="flex flex-col gap-4">
                  {/* Keyword selector */}
                  <div>
                    <p className="text-caption uppercase tracking-wide text-text-tertiary mb-2">
                      Select keywords to search
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {redZoneKeywords.map((kw) => {
                        const selected = selectedKeywords.has(kw.term)
                        return (
                          <button
                            key={kw.id}
                            type="button"
                            onClick={() => toggleKeyword(kw.term)}
                            className={[
                              'px-2 py-0.5 rounded-full text-caption transition-colors whitespace-nowrap',
                              selected
                                ? 'bg-red-300 text-white border border-red-200'
                                : 'bg-red-500/20 text-red-100 hover:bg-red-500/30',
                            ].join(' ')}
                          >
                            {kw.term}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Search button */}
                  <button
                    type="button"
                    disabled={selectedKeywords.size === 0 || searching}
                    onClick={handleSearch}
                    className={[
                      'w-full h-9 rounded-btn text-body font-medium transition-colors',
                      'bg-teal-300 text-text-inverse hover:bg-teal-400',
                      selectedKeywords.size === 0 || searching ? 'opacity-40 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {searching ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-text-inverse animate-pulse-slow" />
                        Searching…
                      </span>
                    ) : 'Search selected'}
                  </button>

                  {/* Quota warning */}
                  {quotaHit && (
                    <p className="text-caption text-amber-200 text-center">
                      YouTube quota reached. Try again tomorrow.
                    </p>
                  )}

                  {/* Results */}
                  {youtubeResults.length > 0 && (
                    <div className="flex flex-col">
                      {youtubeResults.map((video) => (
                        <VideoCard key={video.videoId} video={video} />
                      ))}
                    </div>
                  )}

                  {/* Empty state — after a search with no results */}
                  {!searching && !quotaHit && youtubeResults.length === 0 && selectedKeywords.size > 0 && (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                      <SearchX size={24} strokeWidth={1.5} className="text-text-tertiary" />
                      <p className="text-body-sm text-text-secondary">
                        No results found for this keyword
                      </p>
                    </div>
                  )}

                  {/* Mode B: caption input */}
                  <CaptionInput
                    keywords={keywords}
                    onFlashcards={onNewFlashcards}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
