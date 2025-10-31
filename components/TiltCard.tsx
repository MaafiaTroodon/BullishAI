'use client'

import { useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  hoverScale?: number
  rotateAmplitude?: number
}

export function TiltCard({ hoverScale = 1.06, rotateAmplitude = 8, className = '', children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<any>({})
  const reduced = usePrefersReducedMotion()

  function onMove(e: React.MouseEvent) {
    if (reduced || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left - rect.width / 2
    const offsetY = e.clientY - rect.top - rect.height / 2
    const rx = (-offsetY / (rect.height / 2)) * rotateAmplitude
    const ry = (offsetX / (rect.width / 2)) * rotateAmplitude
    setStyle({
      transform: `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${hoverScale})`,
    })
  }

  function onEnter() {
    if (reduced) return
    setStyle({ transform: `perspective(800px) scale(${hoverScale})` })
  }
  function onLeave() {
    setStyle({ transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)' })
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`tilt-card ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  )
}


