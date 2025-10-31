'use client'

import { useState, useEffect, useRef } from 'react'

interface HeadlineRotatorProps {
  headlines?: string[]
  typingMs?: number
  deletingMs?: number
  holdMs?: number
  startDelayMs?: number
  className?: string
  reducedMotionOverride?: boolean
}

const DEFAULT_HEADLINES = [
  'Trade Smarter. See Sooner.',
  'Markets Move Fast. You Move Faster.',
  'AI That Actually Explains the Market.',
  'Real-Time Edge, On Demand.',
]

// Timings per spec
const DEFAULT_TYPING_MS = 58 // 50–60ms/char (a tad slower for readability)
const DEFAULT_DELETING_MS = 36 // 35–45ms/char (a bit faster for smoothness)
const DEFAULT_HOLD_MS = 1800 // full-text hold
const DEFAULT_START_DELAY_MS = 350 // 300–400ms
const DEFAULT_IDLE_GAP_MS = 0 // idle gap removed per request

export function HeadlineRotator({
  headlines = DEFAULT_HEADLINES,
  typingMs = DEFAULT_TYPING_MS,
  deletingMs = DEFAULT_DELETING_MS,
  holdMs = DEFAULT_HOLD_MS,
  startDelayMs = DEFAULT_START_DELAY_MS,
  className = '',
  reducedMotionOverride,
}: HeadlineRotatorProps) {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'hold' | 'deleting'>('idle')
  const [charIndex, setCharIndex] = useState(0)
  const [isReduced, setIsReduced] = useState(false)
  const [minWidth, setMinWidth] = useState<number | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  // Easing helpers to make typing/deleting feel smoother and less robotic
  function easedTypingDelay(len: number, idx: number) {
    if (len <= 0) return typingMs
    const t = Math.min(1, Math.max(0, idx / len))
    // Slow-in, steady, slight slow-out (cosine ease)
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * t)
    // Map ease to a ±20% variance around base
    const scale = 0.8 + ease * 0.4
    return Math.max(20, Math.round(typingMs * scale))
  }

  function easedDeletingDelay(len: number, remaining: number) {
    if (len <= 0) return deletingMs
    const t = Math.min(1, Math.max(0, 1 - remaining / len))
    // Slight accelerate at the start, then gentle decel at the end
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * t)
    const scale = 0.75 + ease * 0.3 // 75%..105% of base
    return Math.max(16, Math.round(deletingMs * scale))
  }

  // Detect reduced motion preference
  useEffect(() => {
    if (reducedMotionOverride !== undefined) {
      setIsReduced(reducedMotionOverride)
      return
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReduced(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setIsReduced(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [reducedMotionOverride])

  // Measure longest headline width for layout stability
  useEffect(() => {
    if (!measureRef.current || minWidth !== null) return
    const longest = headlines.reduce((a, b) => (a.length > b.length ? a : b))
    measureRef.current.textContent = longest
    const width = measureRef.current.offsetWidth
    setMinWidth(width)
    measureRef.current.textContent = ''
  }, [headlines, minWidth])

  // IntersectionObserver for pausing when off-screen
  useEffect(() => {
    if (!containerRef.current) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false
        setIsVisible(isVisible)
        if (!isVisible) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
        } else {
          // If returning visible and nothing scheduled, re-run current phase tick
          if (!timeoutRef.current && phase === 'idle') {
            const cleanup = startCycle()
            // No-op cleanup in observer context
          }
        }
      },
      { threshold: 0.25 }
    )
    observerRef.current.observe(containerRef.current)
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [phase])

  // Reduced motion mode: instant swaps every 3s
  useEffect(() => {
    if (!isReduced) return
    const swapInterval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % headlines.length
        setDisplayText(headlines[next])
        return next
      })
    }, 3000)
    return () => clearInterval(swapInterval)
  }, [isReduced, headlines])

  const startCycle = () => {
    if (isReduced) {
      // In reduced motion, start with first headline visible
      setDisplayText(headlines[0])
      setCurrentIndex(0)
      return
    }
    
    const timeoutId = setTimeout(() => {
      setPhase('typing')
      setCharIndex(0)
      setDisplayText('')
    }, startDelayMs)
    
    return () => clearTimeout(timeoutId)
  }

  useEffect(() => {
    if (phase === 'idle' && !isReduced) {
      const cleanup = startCycle()
      return cleanup
    }
  }, [])

  // Typing animation (only when visible)
  useEffect(() => {
    if (phase !== 'typing' || isReduced || !isVisible) return
    const currentHeadline = headlines[currentIndex]
    if (!currentHeadline) return
    
    if (charIndex < currentHeadline.length) {
      const delay = easedTypingDelay(currentHeadline.length, charIndex)
      timeoutRef.current = setTimeout(() => {
        setDisplayText(currentHeadline.substring(0, charIndex + 1))
        setCharIndex(prev => prev + 1)
      }, delay)
    } else {
      setPhase('hold')
      setCharIndex(0)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [phase, charIndex, typingMs, headlines, currentIndex, isReduced, isVisible])

  // Hold phase
  useEffect(() => {
    if (phase !== 'hold' || isReduced || !isVisible) return
    timeoutRef.current = setTimeout(() => {
      setPhase('deleting')
    }, holdMs)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [phase, holdMs, isReduced, isVisible])

  // Deleting animation
  useEffect(() => {
    if (phase !== 'deleting' || isReduced || !isVisible) return
    if (displayText.length > 0) {
      const delay = easedDeletingDelay((headlines[currentIndex] || '').length, displayText.length)
      timeoutRef.current = setTimeout(() => {
        setDisplayText(prev => prev.substring(0, prev.length - 1))
        setCharIndex(prev => Math.max(0, prev + 1))
      }, delay)
    } else {
      // Fully deleted → immediately move to next (idle gap removed)
      const nextIndex = (currentIndex + 1) % headlines.length
      setPhase('idle')
      setCurrentIndex(nextIndex)
      setPhase('typing')
      setCharIndex(0)
      setDisplayText('')
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [phase, displayText.length, deletingMs, currentIndex, headlines, isReduced, isVisible])

  // SSR fallback: show first headline
  const ssrText = headlines[0]

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-baseline ${className}`}
      style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
    >
      <h1 
        className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-green-400"
        aria-live="polite"
        role="heading"
        aria-level={1}
      >
        {displayText || ssrText}
        <span 
          className="inline-block w-[2px] h-[1em] ml-1 bg-gradient-to-r from-blue-400 via-purple-400 to-green-400"
          aria-hidden="true"
          style={{
            animation: 'blink-caret 600ms step-end infinite',
          }}
        />
      </h1>
      {/* Hidden measure element */}
      <span
        ref={measureRef}
        className="absolute invisible whitespace-nowrap pointer-events-none opacity-0"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px' }}
      />
    </div>
  )
}

