'use client'

import { useEffect } from 'react'
import { attachInViewAnimations } from '@/hooks/useInViewAnimation'

export function AnimationRoot() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const dispose = attachInViewAnimations(document.body)
      return dispose
    }
    return () => {}
  }, [])
  return null
}


