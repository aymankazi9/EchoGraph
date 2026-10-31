'use client'

import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import * as THREE from 'three'

// Ported from the "Nocturne Landing v2" reference's `initVault()` (THEME_SURGICAL.md §9, Engine
// section): a procedural layered-vault scene that unfolds into a node constellation as the user
// scrolls through a 300vh pinned section. Math/geometry ported verbatim; only the module loading
// (static `three` import instead of a CDN dynamic import) and React lifecycle wiring differ.

interface VaultSceneRefs {
  sectionRef: RefObject<HTMLElement | null>
  hostRef: RefObject<HTMLDivElement | null>
  labelRefs: RefObject<(HTMLDivElement | null)[]>
  redLabelRef: RefObject<HTMLDivElement | null>
  railRef: RefObject<HTMLSpanElement | null>
}

export function useVaultScene(refs: VaultSceneRefs, setPhase: Dispatch<SetStateAction<number>>) {
  useEffect(() => {
    const host = refs.hostRef.current
    const sec = refs.sectionRef.current
    if (!host || !sec) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x050505, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-5, 9, 6); scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(6, 1, -7); scene.add(rim)
    const red = new THREE.PointLight(0xff3b30, 0, 8, 1.6); scene.add(red)
    const world = new THREE.Group(); scene.add(world)

    const S = 3.2
    const HS = [0.14, 0.14, 0.26, 0.14, 0.32]
    const GAP = 0.82
    const total = HS.reduce((a, b) => a + b, 0)
    let acc = 0
    const layers = HS.map((h, i) => {
      const yc = total / 2 - acc - h / 2
      acc += h
      const core = i === 2
      const g = new THREE.Group()
      world.add(g)
      const mm = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.8, metalness: 0.1, transparent: true })
      const box = new THREE.Mesh(new THREE.BoxGeometry(S, h, S), mm)
      const em = new THREE.LineBasicMaterial({ color: core ? 0xff3b30 : 0xededed, transparent: true, opacity: core ? 0.9 : 0.5 })
      const P: number[] = []
      const y = h / 2 + 0.004
      const seg = (a: number, b: number, c: number, d: number) => P.push(a, y, b, c, y, d)
      const sq = (r: number) => { seg(-r, -r, r, -r); seg(r, -r, r, r); seg(r, r, -r, r); seg(-r, r, -r, -r) }
      if (i === 0) for (let k = 0; k <= 44; k++) { const x = -1.32 + (k * 2.64) / 44, a = 0.08 + 0.5 * Math.abs(Math.sin(k * 0.61) * Math.cos(k * 0.19)); seg(x, -a, x, a) }
      if (i === 1) for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const x0 = -1.3 + c * 0.9, z0 = -0.95 + r * 1.0, w = 0.75, d = 0.85; seg(x0, z0, x0 + w, z0); seg(x0 + w, z0, x0 + w, z0 + d); seg(x0 + w, z0 + d, x0, z0 + d); seg(x0, z0 + d, x0, z0) }
      if (i === 2) { [1.2, 0.7, 0.25].forEach(sq); seg(-1.2, 0, -0.25, 0); seg(0.25, 0, 1.2, 0); seg(0, -1.2, 0, -0.25); seg(0, 0.25, 0, 1.2) }
      if (i === 3) for (let k = -3; k <= 3; k++) { const v = k * 0.4; seg(v, -1.3, v, 1.3); seg(-1.3, v, 1.3, v) }
      if (i === 4) { sq(1.35); sq(1.0) }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
      const dm = new THREE.LineBasicMaterial({ color: core ? 0xff3b30 : 0xededed, transparent: true, opacity: core ? 0.75 : 0.3 })
      g.add(box, new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), em), new THREE.LineSegments(dg, dm))
      return { g, h, yc, yo: yc + (2 - i) * GAP, mats: [mm, em, dm] as THREE.Material[], base: [1, em.opacity, dm.opacity] }
    })

    let seed = 7
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const CL: [number, number, number][] = [[0, 0.2, 0], [-2.5, 1.1, -0.9], [2.4, 1.3, 0.7], [-1.7, -1.5, 1.5], [2.0, -1.3, -1.4], [0.3, 2.3, -2.0], [-0.4, -2.4, -1.2]]
    const RC = 2
    interface VNode { c: number; red: boolean; d: number; size: number; p: THREE.Vector3; t: THREE.Vector3; s: THREE.Vector3 }
    const nodes: VNode[] = []
    for (let i = 0; i < 84; i++) {
      const c = i % CL.length
      const L = layers[i % 5]
      const rad = 0.35 + rnd() * 0.55, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1)
      nodes.push({
        c, red: c === RC, d: rnd(), size: 0.035 + rnd() * 0.03, p: new THREE.Vector3(),
        t: new THREE.Vector3(CL[c][0] + rad * Math.sin(ph) * Math.cos(th), CL[c][1] + rad * Math.cos(ph), CL[c][2] + rad * Math.sin(ph) * Math.sin(th)),
        s: new THREE.Vector3((rnd() * 2 - 1) * 1.4, L.yo + L.h / 2 + 0.06, (rnd() * 2 - 1) * 1.4),
      })
    }
    const sg = new THREE.SphereGeometry(1, 14, 10)
    const wM = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: 0xcfcfd2, roughness: 0.8, metalness: 0.1, emissive: 0x2a2a2c }), nodes.filter((n) => !n.red).length)
    const rM = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xff3b30 }), nodes.filter((n) => n.red).length)
    wM.frustumCulled = rM.frustumCulled = false
    world.add(wM, rM)

    const pairs: [number, number][] = []
    nodes.forEach((n, i) =>
      nodes
        .map((m, j) => [j, m] as [number, VNode])
        .filter(([j, m]) => j !== i && m.c === n.c)
        .sort((a, b) => a[1].t.distanceTo(n.t) - b[1].t.distanceTo(n.t))
        .slice(0, 2)
        .forEach(([j]) => { if (!pairs.some((p) => p[0] === j && p[1] === i)) pairs.push([i, j]) }),
    )
    const link = (a: number, b: number) => {
      let best: [number, number] | null = null, bd = 1e9
      nodes.forEach((n, i) => { if (n.c !== a) return; nodes.forEach((m, j) => { if (m.c !== b) return; const d = n.t.distanceTo(m.t); if (d < bd) { bd = d; best = [i, j] } }) })
      if (best) pairs.push(best)
    }
    const LINKS: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 5], [2, 5], [3, 6], [4, 6], [2, 4]]
    LINKS.forEach(([a, b]) => link(a, b))

    const mkL = (ps: [number, number][], color: number) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ps.length * 6), 3))
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })
      const l = new THREE.LineSegments(g, m)
      l.frustumCulled = false
      world.add(l)
      return { g, m, ps, l }
    }
    const wL = mkL(pairs.filter(([a, b]) => !(nodes[a].red && nodes[b].red)), 0xededed)
    const rL = mkL(pairs.filter(([a, b]) => nodes[a].red && nodes[b].red), 0xff3b30)
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.25, 1)),
      new THREE.LineBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }),
    )
    shell.position.set(...CL[RC])
    world.add(shell)

    const lbls = refs.labelRefs.current ?? []
    const redLbl = refs.redLabelRef.current
    const cl = (x: number) => Math.min(1, Math.max(0, x))
    const sm = (a: number, b: number, x: number) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t) }
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const dummy = new THREE.Object3D()
    const v = new THREE.Vector3(), tv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
    let W = 1, H = 1

    const update = (p: number) => {
      const ex = ease(cl(p / 0.36)), fade = sm(0.48, 0.66, p), lock = sm(0.7, 0.88, p), appear = sm(0.36, 0.46, p)
      world.rotation.y = -0.35 + p * 0.5
      layers.forEach((L, i) => {
        L.g.position.y = L.yc + (L.yo - L.yc) * ex
        L.g.rotation.y = fade * 0.32 * (i - 2)
        const sc = 1 + fade * 0.35
        L.g.scale.set(sc, 1, sc)
        const o = 1 - fade
        L.g.visible = o > 0.01
        L.mats.forEach((m, k) => { (m as THREE.Material & { opacity: number }).opacity = L.base[k] * o })
        L.mats[0].depthWrite = o > 0.98
      })
      let wi = 0, ri = 0
      nodes.forEach((n) => {
        const m = ease(cl((p - 0.44 - n.d * 0.08) / 0.16)), a = m * 1.6, ca = Math.cos(a), sa = Math.sin(a)
        v.set(n.s.x * ca - n.s.z * sa, n.s.y, n.s.x * sa + n.s.z * ca).lerp(n.t, m)
        v.y += Math.sin(Math.PI * m) * 0.5
        n.p.copy(v)
        dummy.position.copy(v)
        dummy.scale.setScalar(Math.max(1e-4, n.size * appear * (n.red ? 1 + 0.8 * lock : 1)))
        dummy.updateMatrix()
        if (n.red) rM.setMatrixAt(ri++, dummy.matrix)
        else wM.setMatrixAt(wi++, dummy.matrix)
      })
      wM.instanceMatrix.needsUpdate = rM.instanceMatrix.needsUpdate = true
      const lo = sm(0.56, 0.72, p)
      ;[wL, rL].forEach((L) => {
        const arr = (L.g.attributes.position as THREE.BufferAttribute).array as Float32Array
        L.ps.forEach(([i, j], k) => {
          const A = nodes[i].p, B = nodes[j].p
          arr[k * 6] = A.x; arr[k * 6 + 1] = A.y; arr[k * 6 + 2] = A.z
          arr[k * 6 + 3] = B.x; arr[k * 6 + 4] = B.y; arr[k * 6 + 5] = B.z
        })
        L.g.attributes.position.needsUpdate = true
      })
      wL.m.opacity = 0.22 * lo * (1 - 0.4 * lock)
      rL.m.opacity = 0.9 * lo * (0.35 + 0.65 * lock)
      wL.l.visible = wL.m.opacity > 0.002
      rL.l.visible = rL.m.opacity > 0.002
      wM.visible = rM.visible = appear > 0.002
      shell.material.opacity = 0.35 * lock
      shell.visible = lock > 0.002
      shell.rotation.y = p * 2
      shell.rotation.x = p
      world.updateMatrixWorld()
      const i1 = 18 * sm(0.05, 0.3, p) * (1 - fade), i2 = 26 * lock
      if (i2 > i1) { red.position.set(...CL[RC]).applyMatrix4(world.matrixWorld); red.intensity = i2 }
      else { red.position.set(0, layers[2].g.position.y, 0); red.intensity = i1 }
      const az = 0.75 + ease(lock) * 1.0, el = 0.4 - lock * 0.1, r = 12.5 + 2 * sm(0.45, 0.7, p) - 4 * lock
      tv.set(...CL[RC]).applyAxisAngle(up, world.rotation.y).multiplyScalar(0.55 * lock)
      cam.position.set(tv.x + r * Math.cos(el) * Math.sin(az), tv.y + r * Math.sin(el), tv.z + r * Math.cos(el) * Math.cos(az))
      cam.lookAt(tv)
      cam.updateMatrixWorld()
      const lop = sm(0.08, 0.22, p) * (1 - sm(0.4, 0.5, p))
      lbls.forEach((el, i) => {
        const L = layers[i]
        if (!L || !el) return
        let bx = -1e9, by = 0
        ;([[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]).forEach(([a, b]) => {
          v.set((a * S) / 2, 0, (b * S) / 2).applyMatrix4(L.g.matrixWorld).project(cam)
          const x = ((v.x + 1) / 2) * W
          if (x > bx) { bx = x; by = ((1 - v.y) / 2) * H }
        })
        el.style.opacity = String(lop)
        el.style.transform = `translate(${bx + 12}px,${by - 7}px)`
      })
      if (redLbl) {
        v.set(CL[RC][0], CL[RC][1] + 1.45, CL[RC][2]).applyMatrix4(world.matrixWorld).project(cam)
        redLbl.style.opacity = String(sm(0.78, 0.9, p))
        const lx = Math.min(W - 230, Math.max(16, ((v.x + 1) / 2) * W + 10))
        const ly = Math.min(H - 60, Math.max(80, ((1 - v.y) / 2) * H - 40))
        redLbl.style.transform = `translate(${lx}px,${ly}px)`
      }
      if (refs.railRef.current) refs.railRef.current.style.transform = `scaleY(${p})`
      setPhase(p < 0.4 ? 0 : p < 0.7 ? 1 : 2)
    }

    let cur = 0, last = -1, vis = false
    const size = () => {
      W = host.clientWidth || 1; H = host.clientHeight || 1
      renderer.setSize(W, H, false)
      cam.aspect = W / H
      if (W > 960) cam.setViewOffset(W, H, -W * 0.1, 0, W, H)
      else cam.setViewOffset(W, H, 0, H * 0.14, W, H)
      cam.updateProjectionMatrix()
      last = -1
    }
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting })
    io.observe(sec)
    const ro = new ResizeObserver(size)
    ro.observe(host)
    size()

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!vis) return
      const b = sec.getBoundingClientRect()
      const tgt = cl(-b.top / Math.max(1, b.height - window.innerHeight))
      cur = reduced || Math.abs(tgt - cur) < 0.0005 ? tgt : cur + (tgt - cur) * 0.1
      if (Math.abs(cur - last) < 0.0001) return
      last = cur
      update(cur)
      renderer.render(scene, cam)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // Mount-once: `refs` holds stable useRef objects and `setPhase` is a stable state setter,
    // so re-running this on every render would tear down and rebuild the whole WebGL scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
