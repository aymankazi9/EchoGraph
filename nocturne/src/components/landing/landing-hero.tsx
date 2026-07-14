'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { TopoBackground } from '@/components/marketing/topo-background'

export function LandingHero() {
  const taglineRef = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const go = () => setTimeout(() => runDecrypt(taglineRef.current), 160)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go)
    } else {
      go()
    }
  }, [reduced])

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '96px 24px 80px',
        overflow: 'hidden',
      }}
    >
      <TopoBackground />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 840,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Eyebrow badge */}
        <div
          data-reveal=""
          data-delay="0"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            padding: '5px 13px 5px 11px',
            borderRadius: 9999,
            border: '1px solid #2D2B45',
            background: 'rgba(28,27,40,0.6)',
            backdropFilter: 'blur(8px)',
            marginBottom: 28,
          }}
        >
          <span style={{ position: 'relative', width: 7, height: 7 }}>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: '#F43F5E',
                animation: 'noct-livedot 1.8s ease-in-out infinite',
              }}
            />
          </span>
          <span
            style={{
              fontSize: 12,
              letterSpacing: '0.04em',
              color: '#94A3B8',
            }}
          >
            Measuring professor emphasis, live
          </span>
        </div>

        {/* H1 */}
        <h1
          data-reveal=""
          data-delay="60"
          style={{
            fontSize: 'clamp(40px,7vw,72px)',
            lineHeight: 1.04,
            letterSpacing: '-0.025em',
            fontWeight: 600,
            margin: 0,
            color: '#E2E8F0',
          }}
        >
          Stop studying everything.
          <br />
          <span
            ref={taglineRef}
            style={{
              background: 'linear-gradient(100deg,#A5B4FC 0%,#A78BFA 45%,#FB7185 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Study what gets tested.
          </span>
        </h1>

        {/* Body */}
        <p
          data-reveal=""
          data-delay="140"
          style={{
            fontSize: 'clamp(16px,2vw,18px)',
            lineHeight: 1.6,
            color: '#94A3B8',
            maxWidth: 560,
            margin: '26px 0 0',
          }}
        >
          Nocturne links your lecture audio, slides, and study guide — then surfaces the{' '}
          <span style={{ color: '#FB7185', fontWeight: 500 }}>Red Zone</span>: the handful of keywords your professor actually emphasized, ranked by how likely they are to appear on the exam.
        </p>

        {/* CTAs */}
        <div
          data-reveal=""
          data-delay="220"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            marginTop: 36,
          }}
        >
          <Link
            href="/setup"
            data-btn=""
            data-shine=""
            style={{
              height: 46,
              padding: '0 26px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 500,
              background: '#6366F1',
              color: '#09090F',
              boxShadow: '0 8px 28px rgba(99,102,241,0.35)',
              textDecoration: 'none',
            }}
          >
            Start for free <span data-arrow="" style={{ color: '#09090F' }}>→</span>
          </Link>
          <a
            href="#how"
            data-btn=""
            style={{
              height: 46,
              padding: '0 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 8,
              fontSize: 15,
              color: '#E2E8F0',
              border: '1px solid #2D2B45',
              background: 'rgba(17,17,24,0.5)',
              textDecoration: 'none',
            }}
          >
            See how it works <span data-arrow="" style={{ color: '#5B6478' }}>→</span>
          </a>
        </div>

        {/* Trust signals */}
        <p
          data-reveal=""
          data-delay="300"
          style={{
            fontSize: 13,
            color: '#5B6478',
            marginTop: 26,
            letterSpacing: '0.01em',
          }}
        >
          Zero-knowledge encrypted&nbsp;&nbsp;·&nbsp;&nbsp;Runs in your browser&nbsp;&nbsp;·&nbsp;&nbsp;No credit card required
        </p>
      </div>

      {/* Bottom gradient fade */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 160,
          background: 'linear-gradient(to bottom, transparent, #09090F)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
    </section>
  )
}

function runDecrypt(el: HTMLSpanElement | null) {
  if (!el) return
  const finalText = 'Study what gets tested.'
  const glyphs = '0123456789<>[]{}/\\=+*#%$&?abcdefghijknopqrstuvxyz'
  const n = finalText.length

  const stops: [number, number, number, number][] = [
    [165, 180, 252, 0],
    [167, 139, 250, 0.45],
    [251, 113, 133, 1],
  ]
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
  const colorAt = (p: number) => {
    let i = 0
    while (i < stops.length - 2 && p > stops[i + 1][3]) i++
    const a = stops[i], b = stops[i + 1]
    const sp = (b[3] - a[3]) || 1
    const t = Math.max(0, Math.min(1, (p - a[3]) / sp))
    return `rgb(${lerp(a[0], b[0], t)},${lerp(a[1], b[1], t)},${lerp(a[2], b[2], t)})`
  }

  const cs = getComputedStyle(el)
  const tracking = parseFloat(cs.letterSpacing) || 0
  const mctx = document.createElement('canvas').getContext('2d')!
  mctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`

  // Remove gradient clipping temporarily so individual spans show colors
  el.style.background = 'none'
  el.style.webkitBackgroundClip = 'unset'
  el.style.webkitTextFillColor = 'unset'
  el.style.backgroundClip = 'unset'
  el.style.letterSpacing = '0'
  el.textContent = ''

  const cells: (HTMLSpanElement | null)[] = []
  for (let i = 0; i < n; i++) {
    const ch = finalText[i]
    const cell = document.createElement('span')
    cell.style.display = 'inline-block'
    cell.style.width = mctx.measureText(ch === ' ' ? ' ' : ch).width + 'px'
    cell.style.textAlign = 'center'
    cell.style.marginRight = tracking + 'px'
    if (ch === ' ') {
      cell.style.color = 'transparent'
      cell.textContent = ' '
      cells.push(null)
    } else {
      cell.style.color = colorAt(i / (n - 1))
      cell.textContent = ch
      cells.push(cell)
    }
    el.appendChild(cell)
  }

  const D = 3200
  const settle: number[] = []
  for (let i = 0; i < n; i++) {
    settle[i] = finalText[i] === ' ' ? 0 : 480 + (i / (n - 1)) * 2350 + Math.random() * 300
  }

  const start = performance.now()
  let lastChurn = 0
  el.style.textShadow = '0 0 18px rgba(167,139,250,0.5)'
  let rafId = 0

  const tick = (now: number) => {
    const t = now - start
    const churn = now - lastChurn > 60
    if (churn) lastChurn = now
    let done = true
    for (let i = 0; i < n; i++) {
      const cell = cells[i]
      if (!cell) continue
      if (t >= settle[i]) {
        if (cell.textContent !== finalText[i]) cell.textContent = finalText[i]
      } else {
        done = false
        if (churn) cell.textContent = glyphs[(Math.random() * glyphs.length) | 0]
      }
    }
    const p = Math.min(1, t / D)
    el.style.textShadow = `0 0 ${(18 * (1 - p)).toFixed(1)}px rgba(167,139,250,${(0.5 * (1 - p)).toFixed(2)})`
    if (!done && t < D + 250) {
      rafId = requestAnimationFrame(tick)
    } else {
      el.style.textShadow = ''
    }
  }
  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}
