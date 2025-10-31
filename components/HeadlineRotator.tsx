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

const DEFAULT_TYPING_MS = 45
const DEFAULT_DELETING_MS = 30
const DEFAULT_HOLD_MS = 2000
const DEFAULT_START_DELAY_MS = 400

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
        if (!isVisible && phase !== 'idle') {
          // Pause animation
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
        } else if (isVisible && phase === 'idle') {
          // Resume animation
          startCycle()
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

  // Typing animation
  useEffect(() => {
    if (phase !== 'typing' || isReduced) return
    const currentHeadline = headlines[currentIndex]
    if (!currentHeadline) return
    
    if (charIndex < currentHeadline.length) {
      timeoutRef.current = setTimeout(() => {
        setDisplayText(currentHeadline.substring(0, charIndex + 1))
        setCharIndex(prev => prev + 1)
      }, typingMs)
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
  }, [phase, charIndex, typingMs, headlines, currentIndex, isReduced])

  // Hold phase
  useEffect(() => {
    if (phase !== 'hold' || isReduced) return
    timeoutRef.current = setTimeout(() => {
      setPhase('deleting')
    }, holdMs)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [phase, holdMs, isReduced])

  // Deleting animation
  useEffect(() => {
    if (phase !== 'deleting' || isReduced) return
    if (displayText.length > 0) {
      timeoutRef.current = setTimeout(() => {
        setDisplayText(prev => prev.substring(0, prev.length - 1))
        setCharIndex(prev => prev + 1)
      }, deletingMs)
    } else {
      // Move to next headline
      const nextIndex = (currentIndex + 1) % headlines.length
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
  }, [phase, charIndex, displayText, deletingMs, currentIndex, headlines, isReduced])

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

