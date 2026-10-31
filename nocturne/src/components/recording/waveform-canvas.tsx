'use client'

import { useEffect, useRef } from 'react'

interface Props {
  /** Ref to the live AnalyserNode — read directly in a rAF loop, never through React state. */
  analyserRef: React.RefObject<AnalyserNode | null>
  height?: number
}

// Live time-domain waveform — Web Audio AnalyserNode sampled every frame and
// drawn to a canvas. Deliberately bypasses React state for the per-frame data:
// pushing ~60 samples/s through setState would re-render the whole recording
// bar every frame for no benefit.
export function WaveformCanvas({ analyserRef, height = 44 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = Math.max(1, Math.round(r.width * dpr))
      h = Math.max(1, Math.round(r.height * dpr))
      canvas.width = w
      canvas.height = h
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const buf = new Float32Array(2048)
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const analyser = analyserRef.current
      ctx.clearRect(0, 0, w, h)
      if (!analyser) return

      analyser.getFloatTimeDomainData(buf)
      const n = Math.min(buf.length, analyser.fftSize)
      const mid = h / 2

      ctx.beginPath()
      ctx.strokeStyle = '#FF3B30'
      ctx.lineWidth = Math.max(1, 1.5 * dpr)
      ctx.lineJoin = 'round'
      for (let x = 0; x < w; x++) {
        const i = Math.floor((x / w) * n)
        const y = mid + buf[i] * mid * 0.92
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    if (reduced) {
      // Static centerline — no per-frame animation.
      ctx.beginPath()
      ctx.strokeStyle = '#FF3B30'
      ctx.lineWidth = Math.max(1, 1.5 * dpr)
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
    } else {
      raf = requestAnimationFrame(draw)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [analyserRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height }}
    />
  )
}
