'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'

// Ported from the "Nocturne Landing v2" reference (THEME_SURGICAL.md §6): 3D Perlin noise
// sampled on a grid, marching squares extracts iso-lines, one stroke() per level.
type Variant = 'hero' | 'card' | 'footer'

interface ContourFieldOptions {
  variant: Variant
  intensity?: number
  readoutRef?: RefObject<HTMLDivElement | null>
}

function buildPerm(): Uint8Array {
  const p = new Uint8Array(512)
  const src: number[] = []
  for (let i = 0; i < 256; i++) src[i] = i
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const t = src[i]
    src[i] = src[j]
    src[j] = t
  }
  for (let i = 0; i < 512; i++) p[i] = src[i & 255]
  return p
}

function perlin(perm: Uint8Array, x: number, y: number, z: number): number {
  const fl = Math.floor
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + t * (b - a)
  const grad = (h: number, x: number, y: number, z: number) => {
    h &= 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
  }
  const X = fl(x) & 255, Y = fl(y) & 255, Z = fl(z) & 255
  x -= fl(x); y -= fl(y); z -= fl(z)
  const u = fade(x), v = fade(y), w = fade(z)
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z
  const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z
  return lerp(
    lerp(
      lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
      lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
      lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  )
}

interface Field {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  host: HTMLElement
  variant: Variant
  cell: number
  dprMax: number
  w: number
  h: number
  dpr: number
  cols: number
  rows: number
  cw: number
  ch: number
  vals: Float32Array
  vis: boolean
  seed: number
  mx: number
  my: number
  tmx: number
  tmy: number
}

export function useContourField(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { variant, intensity = 1.5, readoutRef }: ContourFieldOptions,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !host || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const perm = buildPerm()
    const F: Field = {
      canvas, ctx, host, variant,
      cell: variant === 'card' ? 34 : variant === 'hero' ? 22 : 26,
      dprMax: variant === 'card' ? 0.6 : 1.5,
      w: 0, h: 0, dpr: 1, cols: 8, rows: 6, cw: 1, ch: 1,
      vals: new Float32Array(0),
      vis: true,
      seed: Math.random() * 1000,
      mx: -1e5, my: -1e5, tmx: -1e5, tmy: -1e5,
    }

    const resize = () => {
      const r = host.getBoundingClientRect()
      F.w = r.width; F.h = r.height
      F.dpr = Math.min(window.devicePixelRatio || 1, F.dprMax)
      canvas.width = Math.max(1, Math.round(F.w * F.dpr))
      canvas.height = Math.max(1, Math.round(F.h * F.dpr))
      ctx.setTransform(F.dpr, 0, 0, F.dpr, 0, 0)
      F.cols = Math.max(8, Math.round(F.w / F.cell))
      F.rows = Math.max(6, Math.round(F.h / F.cell))
      F.cw = F.w / (F.cols - 1); F.ch = F.h / (F.rows - 1)
      F.vals = new Float32Array(F.cols * F.rows)
    }

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      F.tmx = e.clientX - r.left; F.tmy = e.clientY - r.top
      if (F.mx < -5e4) { F.mx = F.tmx; F.my = F.tmy }
    }
    const onLeave = () => { F.tmx = -1e5; F.tmy = -1e5 }

    const track = () => {
      const inside = F.tmx > -5e4
      if (inside) { F.mx += (F.tmx - F.mx) * 0.14; F.my += (F.tmy - F.my) * 0.14 }
      else { F.mx = -1e5; F.my = -1e5 }
      const el = readoutRef?.current
      if (!el) return
      if (!inside) { el.style.opacity = '0'; return }
      const gx = Math.min(F.cols - 1, Math.max(0, Math.round(F.tmx / F.cw)))
      const gy = Math.min(F.rows - 1, Math.max(0, Math.round(F.tmy / F.ch)))
      const v = F.vals[gx + gy * F.cols] || 0
      const pad = (n: number) => String(Math.round(n)).padStart(4, '0')
      el.style.opacity = '1'
      el.style.transform = `translate(${F.tmx + 18}px,${F.tmy + 18}px)`
      el.textContent = `X ${pad(F.tmx)}  Y ${pad(F.tmy)}  Z ${v.toFixed(3)}`
    }

    const draw = (t: number) => {
      const { cols, rows, cw, ch, vals } = F
      if (!vals.length) return
      const card = variant === 'card'
      const ns = card ? 0.11 : 0.085
      const zt = t * 0.08 + F.seed
      const hasMouse = variant === 'hero' && F.mx > -5e4
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          let v = perlin(perm, gx * ns, gy * ns, zt) * 0.5 + 0.5
          if (hasMouse) {
            const dx = gx * cw - F.mx, dy = gy * ch - F.my, d2 = dx * dx + dy * dy
            if (d2 < 60000) v += 0.3 * Math.exp(-d2 / 14000)
          }
          vals[gx + gy * cols] = v
        }
      }
      ctx.clearRect(0, 0, F.w, F.h)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      const LEVELS = card ? 7 : 12
      const focus = document.documentElement.getAttribute('data-focus') === 'on'
      const breath = variant === 'footer' ? 0.55 + 0.45 * Math.sin(t * 0.9) : 1
      const seg = (ax: number, ay: number, bx: number, by: number) => { ctx.moveTo(ax, ay); ctx.lineTo(bx, by) }

      for (let li = 0; li < LEVELS; li++) {
        const f = li / (LEVELS - 1)
        const thr = 0.18 + f * 0.66
        const top = f > 0.8
        const base = focus ? '255,59,48' : '237,237,237'
        const boost = focus ? 1.5 : 1
        let color: string, a: number, lw: number
        if (card) {
          color = top ? '255,59,48' : base
          a = (top ? 0.5 : 0.06 + 0.22 * f) * intensity * boost
          lw = top ? 3 : 2.5
        } else {
          color = top ? (focus ? '255,120,110' : '255,59,48') : base
          a = (top ? (focus ? 0.75 : 0.5) : 0.03 + 0.10 * f) * intensity * breath * boost
          lw = 1
        }
        ctx.beginPath()
        for (let gy = 0; gy < rows - 1; gy++) {
          for (let gx = 0; gx < cols - 1; gx++) {
            const i = gx + gy * cols
            const tl = vals[i], tr = vals[i + 1], bl = vals[i + cols], br = vals[i + cols + 1]
            let idx = 0
            if (tl > thr) idx |= 8
            if (tr > thr) idx |= 4
            if (br > thr) idx |= 2
            if (bl > thr) idx |= 1
            if (idx === 0 || idx === 15) continue
            const x0 = gx * cw, y0 = gy * ch, x1 = x0 + cw, y1 = y0 + ch
            const tpx = x0 + (thr - tl) / (tr - tl) * cw
            const rpy = y0 + (thr - tr) / (br - tr) * ch
            const bpx = x0 + (thr - bl) / (br - bl) * cw
            const lpy = y0 + (thr - tl) / (bl - tl) * ch
            switch (idx) {
              case 1: case 14: seg(x0, lpy, bpx, y1); break
              case 2: case 13: seg(bpx, y1, x1, rpy); break
              case 3: case 12: seg(x0, lpy, x1, rpy); break
              case 4: case 11: seg(tpx, y0, x1, rpy); break
              case 5: seg(tpx, y0, x1, rpy); seg(x0, lpy, bpx, y1); break
              case 6: case 9: seg(tpx, y0, bpx, y1); break
              case 7: case 8: seg(tpx, y0, x0, lpy); break
              case 10: seg(tpx, y0, x0, lpy); seg(bpx, y1, x1, rpy); break
            }
          }
        }
        ctx.strokeStyle = `rgba(${color},${Math.min(1, a)})`
        ctx.lineWidth = lw
        ctx.stroke()
      }
    }

    resize()
    if (variant === 'hero') {
      host.addEventListener('pointermove', onMove)
      host.addEventListener('pointerleave', onLeave)
    }

    if (reduced) {
      draw(0)
      const ro = new ResizeObserver(() => { resize(); draw(0) })
      ro.observe(host)
      return () => {
        ro.disconnect()
        if (variant === 'hero') {
          host.removeEventListener('pointermove', onMove)
          host.removeEventListener('pointerleave', onLeave)
        }
      }
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(host)
    const io = new IntersectionObserver(([e]) => { F.vis = e.isIntersecting })
    io.observe(host)

    const start = performance.now()
    let frame = 0
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const t = (now - start) / 1000
      frame++
      if (Math.abs(host.clientWidth - F.w) > 1 || Math.abs(host.clientHeight - F.h) > 1) resize()
      if (!F.vis) return
      if (variant === 'card' && (frame & 1)) return
      if (variant === 'hero') track()
      draw(t)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      if (variant === 'hero') {
        host.removeEventListener('pointermove', onMove)
        host.removeEventListener('pointerleave', onLeave)
      }
    }
  }, [canvasRef, variant, intensity, readoutRef])
}
