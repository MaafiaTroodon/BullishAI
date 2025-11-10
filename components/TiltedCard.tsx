'use client'

import type { SpringOptions } from 'framer-motion'
import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import './TiltedCard.css'

interface TiltedCardProps {
  children: React.ReactNode
  containerHeight?: React.CSSProperties['height']
  containerWidth?: React.CSSProperties['width']
  scaleOnHover?: number
  rotateAmplitude?: number
  showMobileWarning?: boolean
  showTooltip?: boolean
  captionText?: string
  gradientFrom?: string
  gradientTo?: string
  className?: string
}

const springValues: SpringOptions = {
  damping: 30,
  stiffness: 100,
  mass: 2
}

export default function TiltedCard({
  children,
  containerHeight = '100%',
  containerWidth = '100%',
  scaleOnHover = 1.05,
  rotateAmplitude = 12,
  showMobileWarning = false,
  showTooltip = false,
  captionText = '',
  gradientFrom = 'rgba(59, 130, 246, 0.1)',
  gradientTo = 'rgba(147, 51, 234, 0.1)',
  className = ''
}: TiltedCardProps) {
  const ref = useRef<HTMLElement>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useMotionValue(0), springValues)
  const rotateY = useSpring(useMotionValue(0), springValues)
  const scale = useSpring(1, springValues)
  const opacity = useSpring(0)
  const rotateFigcaption = useSpring(0, {
    stiffness: 350,
    damping: 30,
    mass: 1
  })
  const gradientOpacity = useSpring(0, springValues)

  const [lastY, setLastY] = useState<number>(0)

  function handleMouse(e: React.MouseEvent<HTMLElement>) {
    if (!ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left - rect.width / 2
    const offsetY = e.clientY - rect.top - rect.height / 2

    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude

    rotateX.set(rotationX)
    rotateY.set(rotationY)

    x.set(e.clientX - rect.left)
    y.set(e.clientY - rect.top)

    const velocityY = offsetY - lastY
    rotateFigcaption.set(-velocityY * 0.6)
    setLastY(offsetY)
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover)
    opacity.set(1)
    gradientOpacity.set(1)
  }

  function handleMouseLeave() {
    opacity.set(0)
    gradientOpacity.set(0)
    scale.set(1)
    rotateX.set(0)
    rotateY.set(0)
    rotateFigcaption.set(0)
  }

  return (
    <figure
      ref={ref}
      className={`tilted-card-figure ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth
      }}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showMobileWarning && (
        <div className="tilted-card-mobile-alert">This effect is not optimized for mobile. Check on desktop.</div>
      )}

      {/* Gradient overlay */}
      <motion.div
        className="tilted-card-gradient"
        style={{
          opacity: gradientOpacity,
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
        }}
      />

      <motion.div
        className="tilted-card-inner"
        style={{
          width: '100%',
          height: '100%',
          rotateX,
          rotateY,
          scale
        }}
      >
        {children}
      </motion.div>

      {showTooltip && captionText && (
        <motion.figcaption
          className="tilted-card-caption"
          style={{
            x,
            y,
            opacity,
            rotate: rotateFigcaption
          }}
        >
          {captionText}
        </motion.figcaption>
      )}
    </figure>
  )
}

