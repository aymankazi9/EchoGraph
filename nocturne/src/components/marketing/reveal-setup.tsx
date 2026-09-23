'use client'
import { useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'

export function RevealSetup() {
  const reduced = useReducedMotion()
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'))
    if (reduced) { els.forEach(el => el.classList.add('is-in')); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement
          const d = parseInt(el.getAttribute('data-delay') || '0', 10)
          el.style.transitionDelay = d + 'ms'
          el.classList.add('is-in')
          io.unobserve(el)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [reduced])
  return null
}
