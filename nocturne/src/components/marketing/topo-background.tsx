'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// --- Perlin noise (classic implementation) ---

function buildPerm(): Uint8Array {
  const p = new Uint8Array(512)
  const src = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const t = src[i]; src[i] = src[j]; src[j] = t
  }
  for (let i = 0; i < 512; i++) p[i] = src[i & 255]
  return p
}

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerpN(a: number, b: number, t: number) { return a + t * (b - a) }
function grad(h: number, x: number, y: number, z: number) {
  h &= 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
}
function perlin(perm: Uint8Array, x: number, y: number, z: number): number {
  const fl = Math.floor
  let X = fl(x) & 255, Y = fl(y) & 255, Z = fl(z) & 255
  x -= fl(x); y -= fl(y); z -= fl(z)
  const u = fade(x), v = fade(y), w = fade(z)
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z
  const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z
  return lerpN(
    lerpN(
      lerpN(grad(perm[AA], x, y, z),         grad(perm[BA], x - 1, y, z), u),
      lerpN(grad(perm[AB], x, y - 1, z),     grad(perm[BB], x - 1, y - 1, z), u),
      v,
    ),
    lerpN(
      lerpN(grad(perm[AA + 1], x, y, z - 1),     grad(perm[BA + 1], x - 1, y, z - 1), u),
      lerpN(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  )
}

// --- Marching squares draw ---

type S = {
  w: number; h: number; dpr: number
  cols: number; rows: number; cw: number; ch: number
  mx: number; my: number; tmx: number; tmy: number
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: S,
  noise: (x: number, y: number, z: number) => number,
  vals: Float32Array,
  LEVELS: number,
  t: number,
  animate: boolean,
) {
  const { cols, rows, cw, ch } = s
  const hasMouse = s.mx > -50000

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let v = noise(gx * 0.085, gy * 0.085, t * 0.10) * 0.5 + 0.5
      if (hasMouse) {
        const dx = gx * cw - s.mx, dy = gy * ch - s.my
        const d2 = dx * dx + dy * dy
        if (d2 < 60000) v += 0.34 * Math.exp(-d2 / 16000)
      }
      vals[gx + gy * cols] = v
    }
  }

  ctx.clearRect(0, 0, s.w, s.h)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const breath = animate ? (0.62 + 0.38 * Math.sin(t * 1.5)) : 1

  const seg = (ax: number, ay: number, bx: number, by: number) => {
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
  }

  for (let li = 0; li < LEVELS; li++) {
    const f = li / (LEVELS - 1)
    const thr = 0.16 + f * 0.70
    let color: string, alpha: number, lw: number, glow: number

    if (f > 0.84)      { color = '244,63,94';   alpha = 0.6 * breath; lw = 1.6; glow = 12 }
    else if (f > 0.66) { color = '167,139,250'; alpha = 0.5;           lw = 1.25; glow = 6 }
    else               { color = '99,102,241';  alpha = 0.09 + 0.20 * f; lw = 1; glow = 0 }

    ctx.beginPath()
    for (let gy = 0; gy < rows - 1; gy++) {
      for (let gx = 0; gx < cols - 1; gx++) {
        const i = gx + gy * cols
        const tl = vals[i], tr = vals[i + 1], bl = vals[i + cols], br = vals[i + cols + 1]
        let idx = 0
        if (tl > thr) idx |= 8; if (tr > thr) idx |= 4
        if (br > thr) idx |= 2; if (bl > thr) idx |= 1
        if (idx === 0 || idx === 15) continue
        const x0 = gx * cw, y0 = gy * ch, x1 = x0 + cw, y1 = y0 + ch
        const tpx = x0 + (thr - tl) / (tr - tl) * cw
        const rpy = y0 + (thr - tr) / (br - tr) * ch
        const bpx = x0 + (thr - bl) / (br - bl) * cw
        const lpy = y0 + (thr - tl) / (bl - tl) * ch
        switch (idx) {
          case 1:  seg(x0, lpy, bpx, y1); break
          case 2:  seg(bpx, y1, x1, rpy); break
          case 3:  seg(x0, lpy, x1, rpy); break
          case 4:  seg(tpx, y0, x1, rpy); break
          case 5:  seg(tpx, y0, x1, rpy); seg(x0, lpy, bpx, y1); break
          case 6:  seg(tpx, y0, bpx, y1); break
          case 7:  seg(tpx, y0, x0, lpy); break
          case 8:  seg(tpx, y0, x0, lpy); break
          case 9:  seg(tpx, y0, bpx, y1); break
          case 10: seg(tpx, y0, x0, lpy); seg(bpx, y1, x1, rpy); break
          case 11: seg(tpx, y0, x1, rpy); break
          case 12: seg(x0, lpy, x1, rpy); break
          case 13: seg(bpx, y1, x1, rpy); break
          case 14: seg(x0, lpy, bpx, y1); break
        }
      }
    }

    ctx.strokeStyle = `rgba(${color},${alpha})`
    ctx.lineWidth = lw
    if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = `rgba(${color},0.85)` }
    else ctx.shadowBlur = 0
    ctx.stroke()
  }
  ctx.shadowBlur = 0
}

// --- Component ---

export function TopoBackground() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const glow = glowRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d')!
    const perm = buildPerm()
    const LEVELS = 13

    const s: S = { w: 0, h: 0, dpr: 1, cols: 0, rows: 0, cw: 0, ch: 0, mx: -99999, my: -99999, tmx: -99999, tmy: -99999 }
    let vals = new Float32Array(0)
    let rafId = 0

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      s.w = r.width; s.h = r.height
      s.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(s.w * s.dpr)
      canvas.height = Math.round(s.h * s.dpr)
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
      s.cols = Math.max(26, Math.round(s.w / 24))
      s.rows = Math.max(18, Math.round(s.h / 24))
      s.cw = s.w / (s.cols - 1)
      s.ch = s.h / (s.rows - 1)
      vals = new Float32Array(s.cols * s.rows)
    }
    window.addEventListener('resize', resize, { passive: true })
    resize()

    // Track cursor via window — pointermove on a pointer-events:none wrapper won't fire.
    // Bounds check restricts the effect to the hero area only.
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      if (x >= 0 && x <= r.width && y >= 0 && y <= r.height) {
        s.tmx = x; s.tmy = y
      } else {
        s.tmx = -99999; s.tmy = -99999
      }
    }
    window.addEventListener('pointermove', onMove)

    const noise = (x: number, y: number, z: number) => perlin(perm, x, y, z)

    if (reduced) {
      drawFrame(ctx, s, noise, vals, LEVELS, 0, false)
    } else {
      const start = performance.now()
      const loop = (now: number) => {
        const t = (now - start) / 1000
        if (s.tmx < -50000) {
          s.mx += (-99999 - s.mx) * 0.08
          s.my += (-99999 - s.my) * 0.08
        } else {
          s.mx += (s.tmx - s.mx) * 0.12
          s.my += (s.tmy - s.my) * 0.12
        }
        if (glow) {
          if (s.tmx > -50000) {
            glow.style.opacity = '1'
            glow.style.transform = `translate(${s.mx}px,${s.my}px)`
          } else {
            glow.style.opacity = '0'
          }
        }
        drawFrame(ctx, s, noise, vals, LEVELS, t, true)
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [reduced])

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0, contain: 'strict' }}
      aria-hidden="true"
    >
      {/* Static ambient glow */}
      <div style={{
        position: 'absolute', top: '8%', left: '50%',
        transform: 'translateX(-50%)',
        width: 760, maxWidth: '90vw', height: 380,
        background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.05) 40%, transparent 72%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />
      {/* Cursor-following rose glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: 340, height: 340,
          margin: '-170px 0 0 -170px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(244,63,94,0.14) 0%, rgba(139,92,246,0.06) 45%, transparent 70%)',
          filter: 'blur(14px)',
          opacity: 0,
          transition: 'opacity .4s',
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  )
}
