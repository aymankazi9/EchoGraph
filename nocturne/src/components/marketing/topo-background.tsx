/*
 * TOPO BACKGROUND TUNING
 *
 * To make pulses more frequent:   decrease GAP_LENGTH (try 40)
 * To make pulses less frequent:   increase GAP_LENGTH (try 80)
 * To make pulses longer/fatter:   increase PULSE_LENGTH (try 12)
 * To make pulses shorter/sharper: decrease PULSE_LENGTH (try 5)
 * To speed up the flow:           decrease BASE_DURATION (try 7)
 * To slow down the flow:          increase BASE_DURATION (try 14)
 * To increase line density:       increase NUM_CONTOUR_LEVELS in noise-field.ts (try 22)
 * To make terrain more complex:   decrease NOISE_SCALE in noise-field.ts (try 0.012)
 * To increase glow intensity:     increase stdDeviation in pulse-glow filter (try 0.6 / 1.0)
 * To make base lines more visible: increase base stroke opacity from 0.10 to 0.15
 *
 * Note: SVG filter IDs (pulse-glow, pulse-glow-strong, topo-fade, topo-mask) must be
 * unique per page. TopoBackground is rendered once — this assumption holds as long as
 * it is not used in multiple simultaneous instances.
 */

'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { generateSingleTerrain } from '@/lib/topo/noise-field'

// Animation constants — adjust via the tuning guide above
const PULSE_LENGTH = 20
const GAP_LENGTH = 900
const BASE_DURATION = 72 // seconds per pulse cycle
const PULSES_PER_PATH = 2

const GRID_WIDTH = 140
const GRID_HEIGHT = 90

// Mid-elevation band (topographic peaks): brighter glow
const MID_LOW = 0.35
const MID_HIGH = 0.70

interface GlowLayerProps {
  reduced: boolean | null
}

function GlowLayer({ reduced }: GlowLayerProps) {
  return (
    <>
      {/* Primary focal glow — indigo, left-center */}
      <motion.div
        animate={
          reduced
            ? undefined
            : { opacity: [0.6, 1, 0.6], x: [0, 15, 0], y: [0, -10, 0] }
        }
        transition={
          reduced
            ? undefined
            : { duration: 14, repeat: Infinity, ease: 'easeInOut' }
        }
        style={{
          position: 'absolute',
          top: '15%',
          left: '25%',
          width: 500,
          height: 350,
          background:
            'radial-gradient(ellipse at center, rgba(99,102,241,0.07) 0%, rgba(99,102,241,0.02) 45%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      {/* Secondary focal glow — violet, right-center */}
      <motion.div
        animate={
          reduced
            ? undefined
            : { opacity: [0.4, 0.8, 0.4], x: [0, -20, 0], y: [0, 12, 0] }
        }
        transition={
          reduced
            ? undefined
            : { duration: 20, repeat: Infinity, ease: 'easeInOut' }
        }
        style={{
          position: 'absolute',
          top: '35%',
          left: '58%',
          width: 400,
          height: 280,
          background:
            'radial-gradient(ellipse at center, rgba(139,92,246,0.05) 0%, rgba(139,92,246,0.015) 40%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}

export function TopoBackground() {
  const [paths, setPaths] = useState<string[]>([])
  const reduced = useReducedMotion()

  // generateSingleTerrain() is CPU-bound — deferred 100ms so first paint completes first.
  // Cancellation flag prevents setState after unmount.
  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => {
      generateSingleTerrain()
        .then((result) => { if (!cancelled) setPaths(result) })
        .catch(() => {})
    }, 100)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [])

  // Scroll parallax — rAF-throttled so CSS property updates sync with paint at 60fps max
  useEffect(() => {
    if (reduced) return
    let rafId: number
    let lastScrollY = 0
    let ticking = false

    const handleScroll = () => {
      lastScrollY = window.scrollY
      if (!ticking) {
        rafId = requestAnimationFrame(() => {
          const offset = Math.min(lastScrollY / (window.innerHeight * 0.8), 1) * 20
          document.documentElement.style.setProperty('--topo-scroll-offset', `${offset}px`)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(rafId)
      document.documentElement.style.removeProperty('--topo-scroll-offset')
    }
  }, [reduced])

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        zIndex: 0,
        contain: 'strict',
        willChange: 'transform',
        transform: 'translateZ(0)',
        maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 85%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 85%)',
      }}
      aria-hidden="true"
    >
      <GlowLayer reduced={reduced} />

      <svg
        viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          willChange: 'transform',
          transform: reduced
            ? undefined
            : 'translateY(calc(var(--topo-scroll-offset, 0px) * -0.15))',
        }}
      >
        <defs>
          {/* Radial vignette — fades contours toward edges */}
          <radialGradient id="topo-fade" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="65%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="topo-mask">
            <rect width="100%" height="100%" fill="url(#topo-fade)" />
          </mask>

        </defs>

        <g mask="url(#topo-mask)">
          {/* Base paths — static, very dim, no filter */}
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(99,102,241,0.10)"
              strokeWidth={0.18}
            />
          ))}

          {/* Standard elevation pulses — one CSS blur on the group, not per-path */}
          {!reduced && (
            <g style={{ filter: 'blur(0.6px)', willChange: 'filter' }}>
              {paths.flatMap((d, i) => {
                const fraction = i / (paths.length - 1 || 1)
                if (fraction >= MID_LOW && fraction <= MID_HIGH) return []
                const delay = i * 0.4
                return Array.from({ length: PULSES_PER_PATH }, (_, pulseIndex) => {
                  const pulseDelay = delay + (pulseIndex * (BASE_DURATION / PULSES_PER_PATH))
                  return (
                    <path
                      key={`${i}-${pulseIndex}`}
                      d={d}
                      fill="none"
                      stroke="rgba(167,139,250,0.6)"
                      strokeWidth={0.22}
                      strokeDasharray={`${PULSE_LENGTH} ${GAP_LENGTH}`}
                      strokeDashoffset={0}
                      style={{
                        animation: 'topo-pulse ' + BASE_DURATION + 's linear -' + pulseDelay + 's infinite',
                      }}
                    />
                  )
                })
              })}
            </g>
          )}

          {/* Mid-elevation pulses — stronger blur for topographic peaks */}
          {!reduced && (
            <g style={{ filter: 'blur(1.0px)', willChange: 'filter' }}>
              {paths.flatMap((d, i) => {
                const fraction = i / (paths.length - 1 || 1)
                if (!(fraction >= MID_LOW && fraction <= MID_HIGH)) return []
                const delay = i * 0.4
                return Array.from({ length: PULSES_PER_PATH }, (_, pulseIndex) => {
                  const pulseDelay = delay + (pulseIndex * (BASE_DURATION / PULSES_PER_PATH))
                  return (
                    <path
                      key={`${i}-${pulseIndex}`}
                      d={d}
                      fill="none"
                      stroke="rgba(167,139,250,0.8)"
                      strokeWidth={0.3}
                      strokeDasharray={`${PULSE_LENGTH} ${GAP_LENGTH}`}
                      strokeDashoffset={0}
                      style={{
                        animation: 'topo-pulse ' + BASE_DURATION + 's linear -' + pulseDelay + 's infinite',
                      }}
                    />
                  )
                })
              })}
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}
