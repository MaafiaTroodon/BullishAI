/**
 * Reveal animation wrapper
 * Fade, rise, slide, or scale elements into view on scroll
 */

'use client'

import { motion, useInView, Variants } from 'framer-motion'
import { useRef, ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface RevealProps {
  children: ReactNode
  variant?: 'fade' | 'rise' | 'slide-left' | 'slide-right' | 'scale'
  delay?: number
  stagger?: number
  once?: boolean
  threshold?: number
  className?: string
}

const variants: Record<string, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  rise: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  'slide-left': {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
  },
  'slide-right': {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
}

export function Reveal({
  children,
  variant = 'fade',
  delay = 0,
  stagger = 0,
  once = true,
  threshold = 0.2,
  className = '',
}: RevealProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, {
    once,
    amount: threshold,
    margin: '0px 0px -10%',
  })
  const prefersReducedMotion = usePrefersReducedMotion()

  const variantConfig = variants[variant] || variants.fade

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variantConfig}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1], // easeOutExpo-like
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

