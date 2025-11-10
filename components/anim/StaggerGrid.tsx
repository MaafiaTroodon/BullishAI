/**
 * Stagger grid animation
 * Animates children with staggered delay
 */

'use client'

import { motion } from 'framer-motion'
import { ReactNode, Children } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface StaggerGridProps {
  children: ReactNode
  staggerDelay?: number
  variant?: 'fade' | 'rise' | 'scale'
  className?: string
}

export function StaggerGrid({
  children,
  staggerDelay = 0.05,
  variant = 'fade',
  className = '',
}: StaggerGridProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  // Convert React children to array
  const childrenArray = Children.toArray(children)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  }

  const itemVariants = {
    hidden: {
      opacity: variant === 'fade' || variant === 'rise' ? 0 : 1,
      y: variant === 'rise' ? 20 : 0,
      scale: variant === 'scale' ? 0.95 : 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {childrenArray.map((child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

