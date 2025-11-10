/**
 * Parallax image effect
 * Moves slower than scroll for depth effect
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface ParallaxImageProps {
  src: string
  alt: string
  speed?: number
  clamp?: boolean
  className?: string
  priority?: boolean
  fill?: boolean
  width?: number
  height?: number
}

export function ParallaxImage({
  src,
  alt,
  speed = 0.15,
  clamp = true,
  className = '',
  priority = false,
  fill = false,
  width,
  height,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion || !ref.current) return

    let rafId: number | null = null

    const handleScroll = () => {
      if (!ref.current) return

      const rect = ref.current.getBoundingClientRect()
      const windowHeight = window.innerHeight
      const elementTop = rect.top
      const elementHeight = rect.height

      // Calculate scroll progress (0 to 1)
      const scrollProgress = Math.max(
        0,
        Math.min(1, (windowHeight - elementTop) / (windowHeight + elementHeight))
      )

      // Calculate offset
      let newOffset = scrollProgress * speed * 100

      if (clamp) {
        const maxOffset = elementHeight * speed
        newOffset = Math.max(-maxOffset, Math.min(maxOffset, newOffset))
      }

      rafId = requestAnimationFrame(() => {
        setOffset(newOffset)
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [speed, clamp, prefersReducedMotion])

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className}>
        {fill ? (
          <Image src={src} alt={alt} fill priority={priority} className="object-cover" />
        ) : (
          <Image src={src} alt={alt} width={width} height={height} priority={priority} className={className} />
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div
        style={{
          transform: `translateY(${offset}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {fill ? (
          <Image src={src} alt={alt} fill priority={priority} className="object-cover" />
        ) : (
          <Image src={src} alt={alt} width={width} height={height} priority={priority} className={className} />
        )}
      </div>
    </div>
  )
}

