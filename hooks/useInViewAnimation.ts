'use client'

import { useEffect } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export function attachInViewAnimations(container: HTMLElement) {
  if (!container) return () => {}
  const reduced = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false

  const targets: HTMLElement[] = []
  const q = '[data-anim]'
  if ((container as any).matches && (container as any).matches(q)) targets.push(container)
  container.querySelectorAll<HTMLElement>(q).forEach(el => targets.push(el))

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target as HTMLElement
      const once = el.getAttribute('data-anim-once') === 'true'
      const thresholdAttr = el.getAttribute('data-anim-threshold')
      const shouldAnimate = entry.intersectionRatio >= (thresholdAttr ? Number(thresholdAttr) : 0.2)

      if (shouldAnimate) {
        runEnter(el, reduced)
        if (once) io.unobserve(el)
      } else if (!once) {
        runExit(el, reduced)
      }
    })
  }, { threshold: buildThresholdList() })

  targets.forEach(el => {
    runExit(el, reduced, true)
    io.observe(el)
  })

  return () => io.disconnect()
}

// Hook wrapper for component-level usage
export function useInViewAnimation(container: HTMLElement | null) {
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    if (!container) return
    const dispose = attachInViewAnimations(container)
    return dispose
  }, [container, reduced])
}

function buildThresholdList() {
  const thresholds: number[] = []
  for (let i = 0; i <= 1.0; i += 0.1) thresholds.push(i)
  return thresholds
}

function runEnter(el: HTMLElement, reduced: boolean) {
  const type = el.getAttribute('data-anim') || 'fade-up'
  const distance = Number(el.getAttribute('data-anim-distance') || 24)
  const duration = Number(el.getAttribute('data-anim-duration') || 600)
  const delay = Number(el.getAttribute('data-anim-delay') || 0)
  const stagger = Number(el.getAttribute('data-anim-stagger') || 0)

  const base = reduced ? { opacity: 1, transform: 'none', transition: 'opacity 180ms ease-out' } :
    { opacity: 1, transform: 'translate3d(0,0,0)', transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1), transform ${duration}ms cubic-bezier(0.22,1,0.36,1)` }

  // Parent
  setTimeout(() => el.style.cssText += styleToString(base), delay)

  // Stagger children
  if (stagger > 0) {
    Array.from(el.children).forEach((child, idx) => {
      const ch = child as HTMLElement
      const d = delay + idx * stagger
      setTimeout(() => ch.style.cssText += styleToString(base), d)
    })
  }
}

function runExit(el: HTMLElement, reduced: boolean, immediate = false) {
  const type = el.getAttribute('data-anim') || 'fade-up'
  const distance = Number(el.getAttribute('data-anim-distance') || 24)
  const duration = Number(el.getAttribute('data-anim-duration') || 600)
  const t = `opacity ${duration}ms ease, transform ${duration}ms ease`

  const hidden = reduced
    ? { opacity: 0, transform: 'none', transition: 'opacity 120ms ease-out' }
    : buildHidden(type, distance, t)

  if (immediate) {
    el.style.cssText += styleToString(hidden)
  } else {
    el.style.cssText += styleToString(hidden)
  }
}

function buildHidden(type: string, distance: number, transition: string) {
  const map: Record<string, string> = {
    'fade': `opacity:0;transform:none;`,
    'fade-up': `opacity:0;transform:translate3d(0, ${distance}px, 0);`,
    'fade-down': `opacity:0;transform:translate3d(0, -${distance}px, 0);`,
    'fade-left': `opacity:0;transform:translate3d(${distance}px, 0, 0);`,
    'fade-right': `opacity:0;transform:translate3d(-${distance}px, 0, 0);`,
    'scale': `opacity:0;transform:scale(0.98);`,
    'rise': `opacity:0;transform:scale(0.98) translate3d(0, ${Math.round(distance/2)}px, 0);`,
  }
  return `${map[type] || map['fade-up']}transition:${transition};will-change:opacity,transform;` as any
}

function styleToString(obj: any) {
  if (typeof obj === 'string') return obj
  return Object.entries(obj).map(([k,v]) => `${k}:${v};`).join('')
}


